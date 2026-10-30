import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, ClipboardCheck, ClipboardPlus, LockKeyhole, MapPin, Play, RefreshCw, ShieldCheck, Siren } from 'lucide-react';
import PageHeader from '../components/PageHeader';
import LoadingState from '../components/Feedback';
import SecureSignIn from '../components/SecureSignIn';
import { useSupabaseAuth } from '../hooks/useSupabaseAuth';
import {
  advanceRequestStatus, assignAuthorizedCollectionTeam, assignRequestTransport, confirmCollectionAtCentre,
  contactNextDonor, createEmergencyRequest, getHospitalMemberships,
  getAuthorizedCollectionTeams, getLicensedCentres, getRequestTimeline, getRequestTransportAssignments,
  listAuthorizedRequests, recordCollectionRelease, verifyRequestInventory,
  proposeCollectionAppointment,
} from '../services/donorNetwork';

import { BLOOD_GROUPS as GROUPS } from '../services/donorNetwork';
const COMPONENTS = [
  ['red_blood_cells', 'Red blood cells'], ['platelets', 'Platelets'],
  ['plasma', 'Plasma'], ['whole_blood', 'Whole blood'],
];
const STATUS_LABELS = {
  submitted: 'Submitted', verifying_inventory: 'Verifying Inventory', stock_available: 'Stock Available',
  searching_for_donors: 'Searching for Donors', donor_contacted: 'Donor Contacted',
  donor_accepted: 'Donor Accepted', collection_arranged: 'Collection Arranged',
  at_authorized_blood_centre: 'At Authorized Blood Centre',
  testing_and_compatibility_checks: 'Testing and Compatibility Checks',
  ready_for_dispatch: 'Ready for Dispatch', dispatched: 'Dispatched',
  received_by_hospital: 'Received by Hospital', completed: 'Completed', cancelled: 'Cancelled',
};
const ACTION_LABELS = {
  arrange_appointment: 'Propose appointment at the authorized blood centre',
  confirm_collection: 'Confirm simulated arrival at the blood centre',
  begin_testing: 'Begin simulated testing-status step',
  confirm_testing_and_release: 'Confirm simulated testing and release',
  assign_transport: 'Assign simulated authorized transport',
  confirm_dispatch: 'Confirm simulated dispatch',
  confirm_receipt: 'Confirm simulated hospital receipt',
  complete: 'Complete after simulated receipt',
  cancel: 'Cancel this synthetic request',
};

function related(value) { return Array.isArray(value) ? value[0] : value; }

function DemoWorkflow({ demoState, onStartDemo, onDemoAction }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const start = async () => {
    setBusy(true); setError('');
    try { await onStartDemo(); }
    catch (issue) { setError(issue.message || 'Could not start the synthetic request.'); }
    finally { setBusy(false); }
  };
  const step = async (action, donorId) => {
    setBusy(true); setError('');
    try { await onDemoAction(action, donorId); }
    catch (issue) { setError(issue.message || 'The synthetic workflow step failed.'); }
    finally { setBusy(false); }
  };
  const state = demoState;
  return <section className="panel synthetic-request-panel">
    <div className="panel-heading"><div><span className="eyebrow">INTERACTIVE WALKTHROUGH</span><h2>Run the deterministic demo request</h2><p>Four synthetic units requested, one synthetic unit in accessible stock, and a shortfall of three.</p></div><span className="demo-watermark">SYNTHETIC</span></div>
    <div className="demo-workflow-steps" aria-label="Request workflow"><span className={state ? 'workflow-step done' : 'workflow-step current'}>1 · Request</span><span>→</span><span className={state ? 'workflow-step current' : 'workflow-step'}>2 · Inventory</span><span>→</span><span className={state?.accepted_donor ? 'workflow-step done' : 'workflow-step'}>3 · Donor response</span><span>→</span><span className={state?.request?.status === 'Completed' ? 'workflow-step done' : 'workflow-step'}>4 · Centre to hospital</span></div>
    {!state && <button type="button" className="button button-primary" onClick={start} disabled={busy}><Play size={15} fill="currentColor" /> {busy ? 'Starting demo…' : 'Start synthetic emergency request'}</button>}
    {state && <div className="synthetic-request-body">
      <div className="simulated-callout"><ShieldCheck size={17} /><span><strong>{state.simulation_label}</strong><br />All donor responses, appointment, collection, testing, release, and transport below are simulated. No person or external service is contacted.</span></div>
      <div className="demo-summary-grid"><div><span>Requested</span><strong>{state.request.units_requested} units</strong><small>{state.request.component} · {state.request.blood_group}</small></div><div><span>Accessible demo stock</span><strong>{state.inventory_check.accessible_units} unit</strong><small>Fixed synthetic inventory</small></div><div><span>Initial shortfall</span><strong>{state.inventory_check.shortfall_units} units</strong><small>Donors are not inventory</small></div><div><span>Current status</span><strong>{state.request.status}</strong><small>{state.request.urgency} · {state.request.id}</small></div></div>
      <p className="helper-text">Hospital-side synthetic candidate count: {state.potential_donors.length}. Only one candidate receives a simulated in-app request at a time.</p>
      {!state.accepted_donor && <p className="helper-text">Open <strong>Donor Network</strong> to accept or decline the current synthetic inbox request. The workflow cannot proceed to an appointment until a donor accepts.</p>}
      {state.accepted_donor && <p className="helper-text">Synthetic donor {state.accepted_donor.donor_id} accepted. No contact details are shown; acceptance does not establish eligibility or a donation.</p>}
      {state.appointment && <div className="appointment-card"><strong>Proposed facility visit · simulated</strong><span>{state.appointment.facility}</span><span>{state.appointment.time}</span><small>Collection team: {state.appointment.collection_team.status}. No team is actually dispatched.</small></div>}
      {state.blood_centre_release && <div className="appointment-card"><strong>Simulated centre-confirmed quantity · not live stock</strong><span>{state.blood_centre_release.confirmed_units} unit(s) confirmed after the demo's simulated collection and testing steps.</span><span>Remaining shortfall in this synthetic walkthrough: {state.inventory_check.remaining_shortfall_units} unit(s).</span></div>}
      {state.next_actions?.filter((action) => ACTION_LABELS[action]).map((action) => <button key={action} type="button" className="button button-primary workflow-action" disabled={busy} onClick={() => step(action)}>{busy ? 'Updating simulated workflow…' : ACTION_LABELS[action]}</button>)}
      {state.request.status === 'Completed' && <div className="notice notice-success"><ShieldCheck size={17} /> Completed after simulated blood-centre release, transport, and hospital receipt. This is not a real fulfillment.</div>}
      {state.request.status === 'Cancelled' && <div className="notice notice-warning"><AlertTriangle size={17} /> Synthetic request cancelled. No real request or notification was created.</div>}
      <div className="timeline-list"><h3>Simulated request history</h3>{state.history.map((event, index) => <div className="timeline-item" key={`${event.status}-${index}`}><i /><span>{event.status}</span><small>{event.at} · simulated</small></div>)}</div>
    </div>}
    {error && <p className="inline-error" role="alert">{error}</p>}
  </section>;
}

export default function EmergencyRequests({ demoState, onStartDemo, onDemoAction }) {
  const { client, configured, user, loading: authLoading } = useSupabaseAuth();
  const [memberships, setMemberships] = useState([]);
  const [centres, setCentres] = useState([]);
  const [collectionTeams, setCollectionTeams] = useState([]);
  const [hospitalId, setHospitalId] = useState('');
  const [requests, setRequests] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [timeline, setTimeline] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [transportAssignments, setTransportAssignments] = useState([]);
  const [formResult, setFormResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [statusFilter, setStatusFilter] = useState('active');
  const [search, setSearch] = useState('');
  const [appointmentCentre, setAppointmentCentre] = useState('');
  const [appointmentTime, setAppointmentTime] = useState('');
  const [transportInstitution, setTransportInstitution] = useState('');
  const [transportEta, setTransportEta] = useState('');
  const [transportReference, setTransportReference] = useState('');
  const [collectionTeamId, setCollectionTeamId] = useState('');
  const [releaseUnits, setReleaseUnits] = useState('');
  const detailRefreshToken = useRef(0);

  const hospitalMemberships = useMemo(() => memberships.filter((row) =>
    ['hospital_admin', 'hospital_staff', 'collection_coordinator'].includes(row.role)
    && related(row.authorized_institutions)?.institution_type === 'hospital'
    && related(row.authorized_institutions)?.verified === true,
  ), [memberships]);
  const activeInstitution = hospitalMemberships.find((row) => row.institution_id === hospitalId);
  const activeHospital = related(activeInstitution?.authorized_institutions);
  const selectedRequest = requests.find((request) => request.id === selectedId);
  const filteredRequests = useMemo(() => requests.filter((request) => {
    const active = !['completed', 'cancelled'].includes(request.status);
    const statusMatches = statusFilter === 'all' || (statusFilter === 'active' ? active : request.status === statusFilter);
    const textMatches = `${request.request_code} ${request.blood_group} ${request.location_city} ${request.approximate_area}`.toLowerCase().includes(search.toLowerCase());
    return statusMatches && textMatches;
  }), [requests, statusFilter, search]);

  const refreshRequests = useCallback(async () => {
    if (!client || !user) { setRequests([]); return; }
    const rows = await listAuthorizedRequests(client);
    setRequests(rows);
    setSelectedId((current) => rows.some((row) => row.id === current) ? current : (rows[0]?.id || ''));
  }, [client, user]);

  const refreshSelectedDetails = useCallback(async (requestId = selectedId) => {
    if (!client || !requestId) return;
    const token = ++detailRefreshToken.current;
    const [history, appointmentResult, transportRows, teamRows] = await Promise.all([
      getRequestTimeline(client, requestId),
      client.from('collection_appointments').select('id,request_id,collection_centre_id,scheduled_at,status,confirmed_units,authorized_institutions(id,name,city,approximate_area)').eq('request_id', requestId).order('scheduled_at', { ascending: true }),
      getRequestTransportAssignments(client, requestId),
      getAuthorizedCollectionTeams(client),
    ]);
    if (token !== detailRefreshToken.current) return;
    if (appointmentResult.error) throw new Error(appointmentResult.error.message);
    setTimeline(history);
    setAppointments(appointmentResult.data || []);
    setTransportAssignments(transportRows);
    setCollectionTeams(teamRows);
  }, [client, selectedId]);

  useEffect(() => {
    if (!client || !user) { setMemberships([]); setCentres([]); setCollectionTeams([]); return; }
    let live = true;
    setLoading(true); setError('');
    Promise.all([getHospitalMemberships(client, user.id), getLicensedCentres(client), getAuthorizedCollectionTeams(client)])
      .then(([memberRows, centreRows, teamRows]) => {
        if (!live) return;
        setMemberships(memberRows);
        setCentres(centreRows);
        setCollectionTeams(teamRows);
        const firstHospital = memberRows.find((row) =>
          ['hospital_admin', 'hospital_staff', 'collection_coordinator'].includes(row.role)
          && related(row.authorized_institutions)?.institution_type === 'hospital'
          && related(row.authorized_institutions)?.verified === true,
        );
        if (firstHospital) setHospitalId((current) => current || firstHospital.institution_id);
      })
      .catch((issue) => { if (live) setError(issue.message || 'Verified institution access could not be checked.'); })
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [client, user]);

  useEffect(() => {
    if (!client || !user) { setRequests([]); return; }
    setLoading(true); setError('');
    refreshRequests()
      .catch((issue) => setError(issue.message || 'Emergency requests could not be loaded.'))
      .finally(() => setLoading(false));
  }, [client, user, refreshRequests]);

  useEffect(() => {
    if (!client || !selectedId) { detailRefreshToken.current += 1; setTimeline([]); setAppointments([]); setTransportAssignments([]); return; }
    let live = true;
    refreshSelectedDetails(selectedId)
      .catch((issue) => { if (live) setError(issue.message || 'Request history could not be loaded.'); });
    return () => { live = false; };
  }, [client, selectedId, refreshSelectedDetails]);

  const submitRequest = async (event) => {
    event.preventDefault(); setBusy(true); setError(''); setMessage(''); setFormResult(null);
    const values = Object.fromEntries(new FormData(event.currentTarget).entries());
    if (!hospitalId || !activeHospital) { setError('Choose a hospital attached to your verified account.'); setBusy(false); return; }
    if (Number(values.units) < 1 || Number(values.units) > 1000 || !Number.isInteger(Number(values.units))) { setError('Unit count must be a whole number from 1 to 1,000.'); setBusy(false); return; }
    if (new Date(values.required_by).getTime() <= Date.now()) { setError('Required-by time must be in the future.'); setBusy(false); return; }
    try {
      const outcome = await createEmergencyRequest(client, { ...values, hospital_id: hospitalId, city: activeHospital.city, approximate_area: activeHospital.approximate_area });
      setFormResult(outcome);
      setMessage(`Request ${outcome.request.request_code} created. Inventory was checked using current, verified, component-specific stock.`);
      await refreshRequests();
      setSelectedId(outcome.request.id);
      event.currentTarget.reset();
    } catch (issue) {
      setError(issue.message || 'Emergency request could not be submitted.');
      // A request may have been inserted before a later inventory call failed.
      // Refresh so that an authorized user can see it and retry verification.
      await refreshRequests().catch(() => {});
    }
    finally { setBusy(false); }
  };

  const refresh = async () => {
    setBusy(true); setError('');
    try { await refreshRequests(); }
    catch (issue) { setError(issue.message || 'Could not refresh requests.'); }
    finally { setBusy(false); }
  };

  const contactNext = async () => {
    setBusy(true); setError(''); setMessage('');
    try {
      const result = await contactNextDonor(client, selectedId);
      setMessage(result.contacted ? 'One consented donor received an in-app request. No SMS or email was sent.' : result.message);
      await refreshRequests();
      await refreshSelectedDetails(selectedId);
    } catch (issue) { setError(issue.message || 'The next donor could not be contacted.'); }
    finally { setBusy(false); }
  };

  const retryInventoryVerification = async () => {
    setBusy(true); setError(''); setMessage('');
    try {
      const result = await verifyRequestInventory(client, selectedId);
      setMessage(`Inventory verification recorded. ${result.inventory.verified_stock_units} unit(s) recorded; shortfall ${result.inventory.shortfall_units} unit(s). Group-label matching does not certify compatibility.`);
      await refreshRequests();
      await refreshSelectedDetails(selectedId);
    } catch (issue) { setError(issue.message || 'Inventory verification could not be retried.'); }
    finally { setBusy(false); }
  };

  const makeAppointment = async (event) => {
    event.preventDefault(); setBusy(true); setError(''); setMessage('');
    try {
      await proposeCollectionAppointment(client, selectedId, appointmentCentre, appointmentTime);
      setMessage('The appointment proposal was saved for the donor to confirm.');
      await refreshRequests();
      await refreshSelectedDetails(selectedId);
    } catch (issue) { setError(issue.message || 'The appointment could not be proposed.'); }
    finally { setBusy(false); }
  };

  const doStatus = async (status) => {
    setBusy(true); setError(''); setMessage('');
    try {
      await advanceRequestStatus(client, selectedId, status);
      setMessage(`Request status recorded as ${STATUS_LABELS[status]}.`);
      await refreshRequests();
      await refreshSelectedDetails(selectedId);
    } catch (issue) { setError(issue.message || 'Authorized status update failed.'); }
    finally { setBusy(false); }
  };

  const confirmCentreArrival = async (appointmentId) => {
    setBusy(true); setError(''); setMessage('');
    try {
      await confirmCollectionAtCentre(client, appointmentId);
      setMessage('Authorized centre staff recorded attendance. No eligibility or testing outcome is inferred.');
      await refreshRequests();
      await refreshSelectedDetails(selectedId);
    } catch (issue) { setError(issue.message || 'Centre confirmation failed.'); }
    finally { setBusy(false); }
  };

  const confirmCentreUnits = async (event, appointmentId) => {
    event.preventDefault();
    const units = Number(releaseUnits);
    if (!Number.isInteger(units) || units < 0 || units > Number(selectedRequest?.shortfall_units ?? 0)) {
      setError('Enter a whole number from zero through the current shortfall.');
      return;
    }
    setBusy(true); setError(''); setMessage('');
    try {
      const result = await recordCollectionRelease(client, appointmentId, units);
      setMessage(`The authorized centre recorded ${result.confirmed_units} unit(s); remaining shortfall is ${result.shortfall_units}.`);
      setReleaseUnits('');
      await refreshRequests();
      await refreshSelectedDetails(selectedId);
    } catch (issue) { setError(issue.message || 'Centre-confirmed units could not be recorded.'); }
    finally { setBusy(false); }
  };

  const assignTransport = async (event) => {
    event.preventDefault(); setBusy(true); setError(''); setMessage('');
    try {
      await assignRequestTransport(client, selectedId, transportInstitution, transportEta || null, transportReference);
      setMessage('Transport assignment recorded by the authorized coordinator. No live GPS tracking is provided.');
      await refreshRequests();
      await refreshSelectedDetails(selectedId);
    } catch (issue) { setError(issue.message || 'Transport assignment could not be saved.'); }
    finally { setBusy(false); }
  };

  const assignCollectionTeam = async (event) => {
    event.preventDefault(); setBusy(true); setError(''); setMessage('');
    try {
      await assignAuthorizedCollectionTeam(client, selectedId, collectionTeamId);
      setMessage('A verified collection-centre team confirmed its assignment. This does not mean the donor has been collected or assessed.');
      await refreshSelectedDetails(selectedId);
    } catch (issue) { setError(issue.message || 'The collection-team assignment could not be recorded.'); }
    finally { setBusy(false); }
  };

  const isHospitalStaff = memberships.some((row) => row.institution_id === selectedRequest?.hospital_institution_id && row.verified && ['hospital_admin','hospital_staff','collection_coordinator'].includes(row.role));
  const isCoordinator = memberships.some((row) => row.institution_id === selectedRequest?.hospital_institution_id && row.verified && row.role === 'collection_coordinator');
  const isCentreStaff = appointments.some((appointment) => memberships.some((row) => row.institution_id === appointment.collection_centre_id && row.verified && ['blood_bank_staff','collection_coordinator'].includes(row.role)));
  const isBankStaff = memberships.some((row) => row.verified && row.role === 'blood_bank_staff');
  const isAssignedTransportStaff = transportAssignments.some((assignment) => memberships.some((row) =>
    row.institution_id === assignment.institution_id && row.verified && ['blood_bank_staff', 'collection_coordinator'].includes(row.role),
  ));
  const confirmedCentreIds = new Set(appointments.filter((appointment) => appointment.status === 'confirmed').map((appointment) => appointment.collection_centre_id));
  const availableCollectionTeams = collectionTeams.filter((team) => team.assignment_status === 'available' && confirmedCentreIds.has(team.institution_id));
  const assignedCollectionTeam = collectionTeams.find((team) => team.assigned_request_id === selectedRequest?.id && team.assignment_status === 'assigned');

  return <>
    <PageHeader eyebrow="HOSPITAL COORDINATION" title="Emergency Blood Request" description="Inventory-first request entry for verified institutions, plus a clearly labelled synthetic presentation workflow." action={user && <button className="button button-secondary button-small" type="button" onClick={refresh} disabled={busy}><RefreshCw size={14} /> Refresh requests</button>} />
    <section className="critical-safety-banner" role="alert"><AlertTriangle size={20} /><div><strong>Critical requests: use established emergency services and blood-bank procedures.</strong><p>BloodFlow-Q is a coordination tool. It does not replace emergency medical services, hospital protocols, or decisions by authorized professionals.</p></div></section>

    {!configured && <section className="notice notice-warning"><LockKeyhole size={18} /><span>Live request entry is disabled until the verified identity service and private database are configured. You can still use the synthetic walkthrough below.</span></section>}
    {configured && !user && !authLoading && <><section className="notice notice-warning"><LockKeyhole size={18} /><span>Hospital accounts are administrator-provisioned. Public users cannot register a hospital or grant themselves a staff role.</span></section><SecureSignIn client={client} allowCreate={false} title="Verified hospital staff sign-in" /></>}
    {authLoading && <LoadingState label="Checking authorized hospital access…" />}
    {configured && user && <>
      <section className="panel request-form-panel">
        <div className="panel-heading"><div><h2>Submit hospital emergency request</h2><p>Only an administrator-verified hospital membership can submit. Inventory is checked against current component-specific records and the same group label; this does not certify compatibility. The aggregate research JSON is not clinical stock.</p></div><ClipboardPlus size={18} className="muted-icon" /></div>
        {loading && <LoadingState label="Checking verified institution and stock access…" />}
        {!loading && !hospitalMemberships.length && <div className="notice notice-warning"><LockKeyhole size={17} /><span>This account has no verified hospital membership. Ask the project administrator to verify the institution and assign a hospital role.</span></div>}
        {!!hospitalMemberships.length && <form className="emergency-request-form" onSubmit={submitRequest}>
          <label>Verified hospital<select className="field-control" value={hospitalId} onChange={(event) => setHospitalId(event.target.value)} required>{hospitalMemberships.map((membership) => { const institution = related(membership.authorized_institutions); return <option key={membership.institution_id} value={membership.institution_id}>{institution.name} · {membership.institution_id}</option>; })}</select></label>
          <label>Hospital location<input className="field-control" type="text" disabled value={activeHospital ? `${activeHospital.city} · ${activeHospital.approximate_area}` : 'Verified institution location'} /></label>
          <label>Required blood group<select className="field-control" name="blood_group" required defaultValue=""><option value="">Select group</option>{GROUPS.map((group) => <option key={group} value={group}>{group}</option>)}</select></label>
          <label>Blood component<select className="field-control" name="component" required defaultValue=""><option value="">Select component</option>{COMPONENTS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <label>Number of units<input className="field-control" name="units" type="number" min="1" max="1000" step="1" required /></label>
          <label>Urgency<select className="field-control" name="urgency" required defaultValue=""><option value="">Select urgency</option><option value="routine">Routine</option><option value="urgent">Urgent</option><option value="critical">Critical</option></select></label>
          <label>Required-by time<input className="field-control" name="required_by" type="datetime-local" required /></label>
          <label>Approximate hospital area<input className="field-control" name="approximate_area" type="text" required maxLength="120" defaultValue={activeHospital?.approximate_area || ''} /></label>
          <label>Authorized representative<input className="field-control" name="representative_name" type="text" required maxLength="120" autoComplete="name" /></label>
          <label>Representative phone<input className="field-control" name="representative_phone" type="tel" required minLength="7" maxLength="40" autoComplete="tel" /></label>
          <label>Representative email <span className="field-optional">optional</span><input className="field-control" name="representative_email" type="email" maxLength="254" autoComplete="email" /></label>
          <label className="form-span-two">Operational notes<textarea className="field-control" name="notes" rows="2" maxLength="1000" placeholder="Do not include patient-identifying or clinical information." /></label>
          <div className="notice notice-info form-span-two"><ShieldCheck size={16} /><span>Submission creates an operational coordination request. Blood-group labels alone do not establish compatibility. No patient-level information belongs in this form.</span></div>
          <button type="submit" className="button button-primary" disabled={busy || !activeHospital}>{busy ? 'Checking verified stock…' : 'Submit and verify inventory'}</button>
        </form>}
        {formResult && <div className="inventory-result-card" role="status"><strong>Request {formResult.request.request_code}</strong><span>Status: {STATUS_LABELS[formResult.inventory.status] || formResult.inventory.status}</span><span>Verified stock with same configured labels: {formResult.inventory.verified_stock_units} unit(s) · shortfall: {formResult.inventory.shortfall_units} unit(s)</span><p>This inventory label match does not establish compatibility; authorized professionals must verify before release.</p>{formResult.inventory.shortfall_units > 0 && <p>One consented candidate was offered an in-app request when available. No donor is counted as an inventory unit. SMS/email delivery is not configured.</p>}</div>}
      </section>

      <section className="panel hospital-request-list-panel"><div className="panel-heading"><div><h2>Requests available to your account</h2><p>Database row-level security limits this list to your verified hospital, participating bank/centre, or notified donor role. Sensitive workflow updates use role-checked database functions.</p></div><Siren size={18} className="muted-icon" /></div>
        <div className="donor-inbox-controls"><label>Filter<select className="field-control" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="active">Active requests</option><option value="all">All statuses</option>{Object.entries(STATUS_LABELS).map(([key,label]) => <option value={key} key={key}>{label}</option>)}</select></label><label>Search<input className="field-control" type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="ID, group, or area" /></label></div>
        {loading && <LoadingState label="Loading institution requests…" />}
        {!loading && !filteredRequests.length && <div className="empty-state"><strong>No requests match</strong><p>Submitted records will appear here. The request history is stored in the configured private database.</p></div>}
        <div className="hospital-request-list">{filteredRequests.map((request) => <button type="button" className={`hospital-request-row ${selectedId === request.id ? 'hospital-request-row-selected' : ''}`} key={request.id} onClick={() => { setSelectedId(request.id); setFormResult(null); }}><span><strong>{request.request_code}</strong><small>{request.blood_group} · {String(request.component).replaceAll('_',' ')} · {request.units_requested} units</small></span><span className={`status-badge request-status-${request.status}`}>{STATUS_LABELS[request.status] || request.status}</span><small>{request.urgency} · {request.location_city}/{request.approximate_area}</small></button>)}</div>
      </section>

      {selectedRequest && <section className="panel request-detail-panel"><div className="panel-heading"><div><span className="eyebrow">AUTHORIZED REQUEST DETAIL</span><h2>{selectedRequest.request_code}</h2><p>{selectedRequest.units_requested} {String(selectedRequest.component).replaceAll('_',' ')} · {selectedRequest.blood_group} · {selectedRequest.urgency} · {STATUS_LABELS[selectedRequest.status]}</p></div><span className="status-badge">{selectedRequest.status}</span></div>
        <div className="request-detail-summary"><span><MapPin size={14} /> {selectedRequest.location_city} · approximate area {selectedRequest.approximate_area}</span><span>Required by: {new Date(selectedRequest.required_by).toLocaleString()}</span><span>Verified stock: {selectedRequest.verified_stock_units ?? 'Not checked'} · shortfall: {selectedRequest.shortfall_units ?? 'Not checked'}</span></div>

        {['submitted','verifying_inventory'].includes(selectedRequest.status) && isHospitalStaff && <div className="request-action-card"><strong>Inventory check pending</strong><p>The request is saved but has not reached a verified stock result. Retry the authorized component-specific inventory check.</p><button className="button button-secondary" disabled={busy} onClick={retryInventoryVerification}>Retry inventory verification</button></div>}

        {(selectedRequest.status === 'searching_for_donors' || selectedRequest.status === 'donor_contacted') && isHospitalStaff && <div className="request-action-card"><strong>Donor outreach</strong><p>One candidate is contacted at a time through the private in-app inbox. Candidate ordering uses the same declared group label, city/approximate area, self-reported availability, and consent; no numerical distance or medical compatibility is calculated. A declined candidate is not contacted again. No SMS or email notification service is configured.</p><button className="button button-secondary" disabled={busy} onClick={contactNext}>Contact next consented candidate</button></div>}

        {selectedRequest.status === 'donor_accepted' && isHospitalStaff && <form className="appointment-form" onSubmit={makeAppointment}><strong>Propose licensed-centre appointment</strong><label>Verified collection centre<select className="field-control" required value={appointmentCentre} onChange={(event) => setAppointmentCentre(event.target.value)}><option value="">Select a verified centre</option>{centres.map((centre) => <option value={centre.id} key={centre.id}>{centre.name} · {centre.city}/{centre.approximate_area}</option>)}</select></label><label>Appointment time<input className="field-control" type="datetime-local" required value={appointmentTime} onChange={(event) => setAppointmentTime(event.target.value)} /></label>{!centres.length && <p className="helper-text">No licensed centre is registered and verified yet. An administrator must add one before proposing a visit.</p>}<button className="button button-primary" disabled={busy || !centres.length}>Propose appointment to donor</button></form>}

        {appointments.map((appointment) => { const centre = related(appointment.authorized_institutions); const centerStaff = memberships.some((row) => row.institution_id === appointment.collection_centre_id && row.verified && ['blood_bank_staff','collection_coordinator'].includes(row.role)); return <div className="appointment-card" key={appointment.id}><strong>Centre appointment · {appointment.status}</strong><span>{centre?.name || 'Verified centre'} · {centre?.city}/{centre?.approximate_area}</span><span>{new Date(appointment.scheduled_at).toLocaleString()}</span>{appointment.confirmed_units !== null && <span>Units confirmed by centre: {appointment.confirmed_units}</span>}{appointment.status === 'confirmed' && centerStaff && <button className="button button-secondary button-small" disabled={busy} onClick={() => confirmCentreArrival(appointment.id)}>Record donor attendance at centre</button>}{appointment.status === 'attended' && centerStaff && selectedRequest.status === 'testing_and_compatibility_checks' && <form className="appointment-form" onSubmit={(event) => confirmCentreUnits(event, appointment.id)}><strong>Record units confirmed by the licensed centre</strong><p className="helper-text">Enter only the quantity this authorized centre has confirmed after its own collection, screening, testing, and release procedures. Donor acceptance is not inventory; this prototype makes no medical assessment.</p><label>Confirmed quantity <input className="field-control" type="number" min="0" max={selectedRequest.shortfall_units ?? 0} step="1" required value={releaseUnits} onChange={(event) => setReleaseUnits(event.target.value)} /></label><button className="button button-secondary" disabled={busy}>Record centre-confirmed quantity</button></form>}</div>; })}
        {assignedCollectionTeam && <div className="notice notice-info"><ShieldCheck size={16} /><span>Authorized collection team assigned: <strong>{assignedCollectionTeam.team_label}</strong>. Assignment is recorded; no dispatch or collection is implied.</span></div>}
        {!assignedCollectionTeam && selectedRequest.status === 'collection_arranged' && isCentreStaff && <form className="appointment-form" onSubmit={assignCollectionTeam}><strong>Assign an authorized collection team (if available)</strong><label>Available centre team<select className="field-control" required value={collectionTeamId} onChange={(event) => setCollectionTeamId(event.target.value)}><option value="">Choose a verified team</option>{availableCollectionTeams.map((team) => { const centre = related(team.authorized_institutions); return <option key={team.id} value={team.id}>{team.team_label} · {centre?.name || 'Verified centre'}</option>; })}</select></label>{!availableCollectionTeams.length && <p className="helper-text">No available authorized team is registered for the donor-confirmed centre. The system will not assume a team has been assigned.</p>}<button className="button button-secondary" disabled={busy || !availableCollectionTeams.length}>Record confirmed team assignment</button></form>}

        {!!transportAssignments.length && <div className="transport-assignment-list"><h3>Authorized transport assignments</h3>{transportAssignments.map((assignment) => { const institution = related(assignment.authorized_institutions); return <article className="appointment-card" key={assignment.id}><strong>{institution?.name || 'Verified institution'} · {assignment.status}</strong><span>{institution?.city || 'Location unavailable'}{institution?.approximate_area ? ` · ${institution.approximate_area}` : ''}</span><span>Estimated arrival: {assignment.estimated_arrival ? new Date(assignment.estimated_arrival).toLocaleString() : 'Not provided'}</span><small>Assignment reference: {assignment.assignment_reference || 'Not provided'} · no live GPS tracking</small></article>; })}</div>}

        {isBankStaff && selectedRequest.status === 'at_authorized_blood_centre' && <button className="button button-secondary" disabled={busy} onClick={() => doStatus('testing_and_compatibility_checks')}>Record testing and compatibility checks started</button>}
        {isBankStaff && selectedRequest.status === 'stock_available' && <button className="button button-secondary" disabled={busy} onClick={() => doStatus('testing_and_compatibility_checks')}>Record authorized testing/compatibility review</button>}
        {isBankStaff && selectedRequest.status === 'testing_and_compatibility_checks' && <button className="button button-secondary" disabled={busy} onClick={() => doStatus('ready_for_dispatch')}>Confirm authorized release and ready for dispatch</button>}
        {isCoordinator && selectedRequest.status === 'ready_for_dispatch' && <form className="appointment-form" onSubmit={assignTransport}><strong>Assign authorized transport</strong><label>Responsible verified institution<select className="field-control" required value={transportInstitution} onChange={(event) => setTransportInstitution(event.target.value)}><option value="">Choose assigned institution</option>{memberships.filter((row) => ['blood_bank_staff','collection_coordinator'].includes(row.role) && related(row.authorized_institutions)?.institution_type === 'blood_bank').map((row) => { const institution = related(row.authorized_institutions); return <option value={row.institution_id} key={row.institution_id}>{institution.name}</option>; })}</select></label><label>Estimated arrival <span className="field-optional">optional; enter only if confirmed</span><input className="field-control" type="datetime-local" value={transportEta} onChange={(event) => setTransportEta(event.target.value)} /></label><label>Assignment reference <span className="field-optional">optional</span><input className="field-control" maxLength="120" value={transportReference} onChange={(event) => setTransportReference(event.target.value)} /></label><button className="button button-secondary" disabled={busy || !transportInstitution}>Record confirmed transport assignment</button><p className="helper-text">No live GPS or tracking is displayed. Assignment is recorded only after an authorized coordinator submits it.</p></form>}
        {selectedRequest.status === 'ready_for_dispatch' && isAssignedTransportStaff && <button className="button button-primary status-advance-button" disabled={busy} onClick={() => doStatus('dispatched')}>Confirm dispatch</button>}
        {selectedRequest.status === 'dispatched' && isHospitalStaff && <button className="button button-primary status-advance-button" disabled={busy} onClick={() => doStatus('received_by_hospital')}>Confirm hospital receipt</button>}
        {selectedRequest.status === 'received_by_hospital' && isHospitalStaff && <button className="button button-primary status-advance-button" disabled={busy} onClick={() => doStatus('completed')}>Mark request completed</button>}
        {isHospitalStaff && !['completed','cancelled'].includes(selectedRequest.status) && <button className="button button-danger status-cancel-button" disabled={busy} onClick={() => doStatus('cancelled')}>Cancel request</button>}
        <div className="timeline-list"><h3>Request audit history</h3>{timeline.map((entry) => <div className="timeline-item" key={entry.id}><i /><span>{STATUS_LABELS[entry.to_status] || entry.to_status}</span><small>{new Date(entry.recorded_at).toLocaleString()}</small></div>)}</div>
      </section>}
      <p className="donor-response-note">No direct donor-to-patient transfer exists in this workflow. Collection, screening, testing, compatibility verification, release, and dispatch require authorized licensed-facility personnel.</p>
    </>}
    {message && <p className="inline-success" role="status">{message}</p>}{error && <p className="inline-error" role="alert">{error}</p>}

    <DemoWorkflow demoState={demoState} onStartDemo={onStartDemo} onDemoAction={onDemoAction} />
  </>;
}
