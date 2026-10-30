export const BLOOD_GROUPS = Object.freeze(['A+', 'B+', 'AB+', 'O+']);
function validateBloodGroup(group) {
  if (!BLOOD_GROUPS.includes(group)) throw new Error('Choose a supported positive blood group.');
}

/** Supabase table/RPC calls live in one service module rather than UI pages. */
export async function saveDonorProfile(client, userId, profile) {
  validateBloodGroup(profile.blood_group);
  const { data, error } = await client.from('donor_profiles')
    .upsert({ ...profile, user_id: userId }, { onConflict: 'user_id' })
    .select('*').single();
  if (error) throw new Error(error.message);
  return data;
}

export async function getDonorProfile(client, userId) {
  const { data, error } = await client.from('donor_profiles').select('*').eq('user_id', userId).maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

export async function updateDonorProfile(client, userId, updates) {
  if (updates.blood_group !== undefined) validateBloodGroup(updates.blood_group);
  const { data, error } = await client.from('donor_profiles').update(updates).eq('user_id', userId).select('*').single();
  if (error) throw new Error(error.message);
  return data;
}

export async function getDonorInbox(client) {
  const { data, error } = await client.from('donor_request_notifications')
    .select('id,status,contacted_at,responded_at,suggestion_reason,emergency_blood_requests(id,request_code,blood_group,component,units_requested,urgency,required_by,location_city,approximate_area,status)')
    .order('contacted_at', { ascending: false }).limit(100);
  if (error) throw new Error(error.message);
  return (data || []).filter((row) => BLOOD_GROUPS.includes(row.emergency_blood_requests?.blood_group));
}

export async function respondToDonorRequest(client, notificationId, response) {
  const { data, error } = await client.rpc('respond_to_donor_request', {
    p_notification_id: notificationId,
    p_response: response,
  });
  if (error) throw new Error(error.message);
  return data;
}

export async function getDonorConsentHistory(client, userId) {
  const { data, error } = await client.from('donor_consent_events')
    .select('id,consent_kind,granted,recorded_at,source')
    .eq('donor_user_id', userId).order('recorded_at', { ascending: false }).limit(100);
  if (error) throw new Error(error.message);
  return data || [];
}

export async function getDonorAppointments(client) {
  const { data, error } = await client.from('collection_appointments')
    .select('id,request_id,collection_centre_id,scheduled_at,status,authorized_institutions(id,name,city,approximate_area),emergency_blood_requests(request_code,blood_group,component)')
    .order('scheduled_at', { ascending: true }).limit(100);
  if (error) throw new Error(error.message);
  return (data || []).filter((row) => BLOOD_GROUPS.includes(row.emergency_blood_requests?.blood_group));
}

export async function respondToCollectionAppointment(client, appointmentId, confirm) {
  const { data, error } = await client.rpc('respond_to_collection_appointment', {
    p_appointment_id: appointmentId,
    p_confirm: confirm,
  });
  if (error) throw new Error(error.message);
  return data;
}

export async function getHospitalMemberships(client, userId) {
  const { data, error } = await client.from('institution_memberships')
    .select('institution_id,role,verified,authorized_institutions(id,name,institution_type,city,approximate_area,verified)')
    .eq('user_id', userId).eq('verified', true);
  if (error) throw new Error(error.message);
  return (data || []).filter((row) => row.authorized_institutions?.verified);
}

export async function createEmergencyRequest(client, input) {
  validateBloodGroup(input.blood_group);
  const { data, error } = await client.rpc('create_emergency_blood_request', {
    p_hospital_id: input.hospital_id,
    p_blood_group: input.blood_group,
    p_component: input.component,
    p_units: Number(input.units),
    p_urgency: input.urgency,
    p_required_by: new Date(input.required_by).toISOString(),
    p_city: input.city,
    p_approximate_area: input.approximate_area,
    p_representative_name: input.representative_name,
    p_representative_phone: input.representative_phone,
    p_representative_email: input.representative_email || null,
    p_notes: input.notes || null,
  });
  if (error) throw new Error(error.message);
  const request = Array.isArray(data) ? data[0] : data;
  const { data: inventory, error: inventoryError } = await client.rpc('verify_request_inventory', { p_request_id: request.id });
  if (inventoryError) throw new Error(`Request was created, but inventory verification failed: ${inventoryError.message}`);
  let firstDonorNotification = null;
  if (inventory?.shortfall_units > 0) {
    const { data: notification, error: notifyError } = await client.rpc('notify_next_donor', { p_request_id: request.id });
    if (notifyError) throw new Error(`Request is saved, but donor inbox matching failed: ${notifyError.message}`);
    firstDonorNotification = notification;
  }
  return { request, inventory, firstDonorNotification };
}

export async function contactNextDonor(client, requestId) {
  const { data, error } = await client.rpc('notify_next_donor', { p_request_id: requestId });
  if (error) throw new Error(error.message);
  return data;
}

export async function verifyRequestInventory(client, requestId) {
  const { data: inventory, error } = await client.rpc('verify_request_inventory', { p_request_id: requestId });
  if (error) throw new Error(error.message);
  let firstDonorNotification = null;
  if (inventory?.shortfall_units > 0) {
    const { data, error: notifyError } = await client.rpc('notify_next_donor', { p_request_id: requestId });
    if (notifyError) throw new Error(`Inventory is verified, but donor matching could not proceed: ${notifyError.message}`);
    firstDonorNotification = data;
  }
  return { inventory, firstDonorNotification };
}

export async function listAuthorizedRequests(client) {
  const fields = 'id,request_code,hospital_institution_id,blood_group,component,units_requested,urgency,required_by,location_city,approximate_area,status,verified_stock_units,shortfall_units,created_at,updated_at';
  const { data, error } = await client.from('emergency_blood_requests')
    // Postgres row-level security filters this to requests the signed-in user
    // is allowed to see (hospital, participating bank/centre, or notified donor).
    .select(fields).in('blood_group', BLOOD_GROUPS).order('created_at', { ascending: false }).limit(100);
  if (error) throw new Error(error.message);
  const urgencyPriority = { critical: 0, urgent: 1, routine: 2 };
  return (data || []).sort((left, right) =>
    (urgencyPriority[left.urgency] ?? 3) - (urgencyPriority[right.urgency] ?? 3)
    || new Date(left.required_by).getTime() - new Date(right.required_by).getTime()
    || new Date(left.created_at).getTime() - new Date(right.created_at).getTime(),
  );
}

export async function getRequestTransportAssignments(client, requestId) {
  const { data, error } = await client.from('transport_assignments')
    .select('id,request_id,institution_id,status,estimated_arrival,assignment_reference,created_at,authorized_institutions(id,name,city,approximate_area)')
    .eq('request_id', requestId).order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return data || [];
}

export async function getRequestTimeline(client, requestId) {
  const { data, error } = await client.from('request_status_history')
    .select('id,from_status,to_status,recorded_at').eq('request_id', requestId)
    .order('recorded_at', { ascending: true }).limit(100);
  if (error) throw new Error(error.message);
  return data || [];
}

export async function advanceRequestStatus(client, requestId, status) {
  const { data, error } = await client.rpc('advance_emergency_request', {
    p_request_id: requestId,
    p_status: status,
    p_note: null,
  });
  if (error) throw new Error(error.message);
  return data;
}

export async function getDashboardMetrics(client) {
  const { data, error } = await client.rpc('get_coordination_dashboard');
  if (error) {
    // Keep the database error code so the dashboard can distinguish an
    // authorization denial from a connection/query failure without showing
    // internal database details to the user.
    throw Object.assign(new Error(error.message), { code: error.code });
  }
  return data;
}

export async function getLicensedCentres(client) {
  const { data, error } = await client.from('authorized_institutions')
    .select('id,name,city,approximate_area').eq('institution_type', 'licensed_collection_centre').eq('verified', true)
    .order('name').limit(100);
  if (error) throw new Error(error.message);
  return data || [];
}

export async function proposeCollectionAppointment(client, requestId, centreId, scheduledAt) {
  const { data, error } = await client.rpc('propose_collection_appointment', {
    p_request_id: requestId,
    p_collection_centre_id: centreId,
    p_scheduled_at: new Date(scheduledAt).toISOString(),
  });
  if (error) throw new Error(error.message);
  return data;
}

export async function confirmCollectionAtCentre(client, appointmentId) {
  const { data, error } = await client.rpc('confirm_collection_at_centre', { p_appointment_id: appointmentId });
  if (error) throw new Error(error.message);
  return data;
}

/**
 * Record only the number of units an authorized licensed centre confirms.
 * A donor accepting a request is never counted as a blood unit.
 */
export async function recordCollectionRelease(client, appointmentId, units) {
  const { data, error } = await client.rpc('record_collection_release', {
    p_appointment_id: appointmentId,
    p_units: Number(units),
  });
  if (error) throw new Error(error.message);
  return data;
}

export async function assignRequestTransport(client, requestId, institutionId, eta, reference) {
  const { data, error } = await client.rpc('assign_request_transport', {
    p_request_id: requestId,
    p_institution_id: institutionId,
    p_estimated_arrival: eta ? new Date(eta).toISOString() : null,
    p_assignment_reference: reference || null,
  });
  if (error) throw new Error(error.message);
  return data;
}

export async function getAuthorizedCollectionTeams(client) {
  const { data, error } = await client.from('authorized_collection_teams')
    .select('id,institution_id,team_label,assignment_status,assigned_request_id,authorized_institutions(id,name,city,approximate_area)')
    .order('team_label').limit(100);
  if (error) throw new Error(error.message);
  return data || [];
}

export async function assignAuthorizedCollectionTeam(client, requestId, teamId) {
  const { data, error } = await client.rpc('assign_authorized_collection_team', {
    p_request_id: requestId,
    p_team_id: teamId,
  });
  if (error) throw new Error(error.message);
  return data;
}
