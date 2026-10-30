import { useCallback, useEffect, useMemo, useState } from 'react';
import { HeartHandshake, LockKeyhole, MapPin, ShieldCheck, UserRound, UserRoundX } from 'lucide-react';
import PageHeader from '../components/PageHeader';
import LoadingState from '../components/Feedback';
import SecureSignIn from '../components/SecureSignIn';
import { useSupabaseAuth } from '../hooks/useSupabaseAuth';
import {
  getDonorAppointments, getDonorConsentHistory, getDonorInbox, getDonorProfile,
  respondToCollectionAppointment, respondToDonorRequest, saveDonorProfile, updateDonorProfile,
} from '../services/donorNetwork';

const EMPTY_PROFILE = {
  full_name: '', blood_group: '', phone: '', email: '', city: '', approximate_area: '',
  availability: 'temporarily_unavailable', preferred_contact: 'phone',
  consent_receive_requests: false, consent_share_contact: false,
};
import { BLOOD_GROUPS as BLOOD_GROUPS } from '../services/donorNetwork';

function normalizeRequest(notification) {
  const related = notification.emergency_blood_requests;
  return Array.isArray(related) ? related[0] : related;
}

export default function DonorNetwork({ demoState, onStartDemo, onDemoAction }) {
  const { client, configured, session, user, loading: authLoading } = useSupabaseAuth();
  const [profile, setProfile] = useState(EMPTY_PROFILE);
  const [profileExists, setProfileExists] = useState(false);
  const [inbox, setInbox] = useState([]);
  const [consentHistory, setConsentHistory] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [busyNotification, setBusyNotification] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [demoBusy, setDemoBusy] = useState(false);
  // This sandbox is deliberately local to the page. It lets a presenter
  // exercise donor profile and consent controls without sending personal data
  // to Supabase or contacting anyone.
  const [sandboxOpen, setSandboxOpen] = useState(false);
  const [sandboxSaved, setSandboxSaved] = useState(false);
  const [sandboxProfile, setSandboxProfile] = useState({
    full_name: 'Synthetic Donor A', blood_group: 'O+', phone: '+910000000001',
    email: 'donor-a@example.invalid', city: 'Demo City', approximate_area: 'North District',
    availability: 'temporarily_unavailable', preferred_contact: 'phone',
    consent_receive_requests: false, consent_share_contact: false,
  });
  const [sandboxRegisteredAt, setSandboxRegisteredAt] = useState('');
  const [sandboxUpdatedAt, setSandboxUpdatedAt] = useState('');
  const [sandboxMessage, setSandboxMessage] = useState('');

  const reload = useCallback(async () => {
    if (!client || !user) return;
    setLoading(true); setError('');
    try {
      const [loadedProfile, loadedInbox, loadedConsent, loadedAppointments] = await Promise.all([
        getDonorProfile(client, user.id), getDonorInbox(client), getDonorConsentHistory(client, user.id), getDonorAppointments(client),
      ]);
      setProfileExists(Boolean(loadedProfile));
      setProfile({ ...EMPTY_PROFILE, ...(loadedProfile || {}) });
      setInbox(loadedInbox);
      setConsentHistory(loadedConsent);
      setAppointments(loadedAppointments);
    } catch (issue) { setError(issue.message || 'Private donor information could not be loaded.'); }
    finally { setLoading(false); }
  }, [client, user]);

  useEffect(() => { reload(); }, [reload]);

  const filteredInbox = useMemo(() => inbox.filter((notification) => {
    const request = normalizeRequest(notification) || {};
    const statusMatches = statusFilter === 'all' || notification.status === statusFilter;
    const searchMatches = `${request.request_code || ''} ${request.location_city || ''} ${request.blood_group || ''}`.toLowerCase().includes(search.toLowerCase());
    return statusMatches && searchMatches;
  }), [inbox, statusFilter, search]);

  const save = async (event) => {
    event.preventDefault(); setSaving(true); setError(''); setMessage('');
    const form = event.currentTarget;
    const formData = new FormData(form);
    const clean = Object.fromEntries(formData.entries());
    const outreachConsent = formData.get('consent_receive_requests') === 'on';
    const contactShareConsent = formData.get('consent_share_contact') === 'on';
    if (clean.preferred_contact === 'email' && !clean.email?.trim()) {
      setError('Enter an email address if email is your preferred contact method.'); setSaving(false); return;
    }
    if (!/^\+?[0-9][0-9()\-\s]{6,38}$/.test(clean.phone.trim())) {
      setError('Enter a phone number with 7–40 digits or common phone punctuation.'); setSaving(false); return;
    }
    const payload = {
      full_name: clean.full_name.trim(), blood_group: clean.blood_group,
      phone: clean.phone.trim(), email: clean.email.trim() || null,
      city: clean.city.trim(), approximate_area: clean.approximate_area.trim(),
      availability: outreachConsent ? clean.availability : 'do_not_contact',
      preferred_contact: clean.preferred_contact,
      consent_receive_requests: outreachConsent,
      consent_share_contact: contactShareConsent,
    };
    try {
      const saved = await saveDonorProfile(client, user.id, payload);
      setProfile({ ...EMPTY_PROFILE, ...saved }); setProfileExists(true);
      setMessage('Your private donor profile was saved. Registration does not confirm donation eligibility.');
      await reload();
    } catch (issue) { setError(issue.message || 'The profile could not be saved.'); }
    finally { setSaving(false); }
  };

  const changeAvailability = async (availability) => {
    setError(''); setMessage('');
    try {
      const next = (availability === 'available' && !profile.consent_receive_requests)
        ? 'do_not_contact' : availability;
      const updated = await updateDonorProfile(client, user.id, { availability: next });
      setProfile((current) => ({ ...current, ...updated }));
      setMessage(next === 'available' ? 'Availability set to Available.' : 'Availability preference updated.');
      await reload();
    } catch (issue) { setError(issue.message || 'Availability could not be updated.'); }
  };

  const withdrawConsent = async () => {
    setError(''); setMessage('');
    try {
      const updated = await updateDonorProfile(client, user.id, {
        consent_receive_requests: false,
        consent_share_contact: false,
        availability: 'do_not_contact',
      });
      setProfile((current) => ({ ...current, ...updated }));
      setMessage('Both optional consents were withdrawn. New requests stop, and pending in-app notifications are withdrawn.');
      await reload();
    } catch (issue) { setError(issue.message || 'Consent could not be withdrawn.'); }
  };

  const respond = async (notificationId, response) => {
    setBusyNotification(notificationId); setError(''); setMessage('');
    try {
      await respondToDonorRequest(client, notificationId, response);
      setMessage(`Your response was recorded as ${response}. No medical eligibility was assessed.`);
      await reload();
    } catch (issue) { setError(issue.message || 'The response could not be recorded.'); }
    finally { setBusyNotification(''); }
  };

  const respondToAppointment = async (appointmentId, confirm) => {
    setBusyNotification(appointmentId); setError(''); setMessage('');
    try {
      await respondToCollectionAppointment(client, appointmentId, confirm);
      setMessage(confirm ? 'Your appointment response was saved.' : 'The appointment was declined.');
      await reload();
    } catch (issue) { setError(issue.message || 'The appointment response could not be saved.'); }
    finally { setBusyNotification(''); }
  };

  const runDemo = async () => {
    setDemoBusy(true); setError('');
    try { await onStartDemo(); }
    catch (issue) { setError(issue.message || 'The synthetic demo inbox could not be loaded.'); }
    finally { setDemoBusy(false); }
  };
  const respondDemo = async (action, donorId) => {
    setDemoBusy(true); setError('');
    try { await onDemoAction(action, donorId); }
    catch (issue) { setError(issue.message || 'The simulated response could not be recorded.'); }
    finally { setDemoBusy(false); }
  };

  const saveSandboxProfile = (event) => {
    event.preventDefault();
    setSandboxMessage('');
    if (!/^\+?[0-9][0-9()\-\s]{6,38}$/.test(sandboxProfile.phone.trim())) {
      setSandboxMessage('Enter a sample phone value containing 7–40 digits.');
      return;
    }
    if (sandboxProfile.preferred_contact === 'email' && !sandboxProfile.email.trim()) {
      setSandboxMessage('Add a sample email address when email is the preferred contact method.');
      return;
    }
    // Without outreach consent, the sandbox enforces the same safe default as
    // the live profile service: the donor cannot remain marked as available.
    const nextProfile = sandboxProfile.consent_receive_requests
      ? sandboxProfile
      : { ...sandboxProfile, availability: 'do_not_contact', consent_share_contact: false };
    setSandboxProfile(nextProfile);
    const now = new Date().toISOString();
    setSandboxRegisteredAt((current) => current || now);
    setSandboxUpdatedAt(now);
    setSandboxSaved(true);
    setSandboxMessage(sandboxSaved ? 'Synthetic profile updated in this page only.' : 'Synthetic profile registered in this page only.');
  };

  const withdrawSandboxConsent = () => {
    setSandboxProfile((current) => ({
      ...current, consent_receive_requests: false, consent_share_contact: false,
      availability: 'do_not_contact',
    }));
    setSandboxUpdatedAt(new Date().toISOString());
    setSandboxMessage('Synthetic consents withdrawn; sample donor is now Do Not Contact.');
  };

  return <>
    <PageHeader eyebrow="VOLUNTEER COORDINATION" title="Donor Network" description="Manage a private volunteer profile and review in-app requests. A donor response is not a donation or an eligibility determination." />
    {!configured && <section className="notice notice-warning donor-live-gate" role="status"><LockKeyhole size={19} /><div><strong>Live Supabase profile access is unavailable in this build</strong><p>The live profile area needs the public Supabase project URL and publishable key. Use the synthetic sandbox below to test the donor controls; its sample state is not saved or transmitted.</p></div></section>}
    {configured && !user && !authLoading && <>
      <section className="notice notice-warning donor-live-gate"><LockKeyhole size={18} /><div><strong>Private sign-in is required</strong><p>Only your authenticated account can read or change its own donor profile. Sign-in uses a Supabase one-time code; delivery depends on the project’s email or SMS provider settings. The synthetic sandbox below needs no sign-in.</p></div></section>
      <SecureSignIn client={client} allowCreate title="Create or access a donor account" />
    </>}
    {authLoading && <LoadingState label="Checking private donor sign-in…" />}
    {configured && user && <>
      {loading && <LoadingState label="Loading your private donor profile and inbox…" />}
      {!loading && <>
        <div className="donor-account-strip"><span>Signed in as <strong>{user.email || user.phone || 'verified account'}</strong></span><button type="button" className="button button-secondary button-small" onClick={() => client.auth.signOut()}>Sign out</button></div>
        <div className="notice notice-info donor-live-gate"><ShieldCheck size={18} /><div><strong>Privacy and eligibility</strong><p>Your name and contact details are private. A separate sharing consent controls whether an authorized institution can view contact details after you accept. Registration never guarantees eligibility to donate; authorized personnel at a licensed facility assess it.</p></div></div>
        <div className="coordination-columns">
          <section className="panel donor-panel">
            <div className="panel-heading"><div><h2>{profileExists ? 'Edit donor profile' : 'Donor registration'}</h2><p>Only information needed for voluntary coordination is requested. Use city and an approximate area, never a home address.</p></div><UserRound size={18} className="muted-icon" /></div>
            <form className="donor-profile-form" onSubmit={save}>
              <label>Full name<input name="full_name" className="field-control" type="text" required maxLength="120" autoComplete="name" value={profile.full_name || ''} onChange={(event) => setProfile((current) => ({ ...current, full_name: event.target.value }))} /></label>
              <label>Blood group<select name="blood_group" className="field-control" required value={profile.blood_group || ''} onChange={(event) => setProfile((current) => ({ ...current, blood_group: event.target.value }))}><option value="">Choose a group</option>{BLOOD_GROUPS.map((group) => <option key={group}>{group}</option>)}</select></label>
              <label>Phone number<input name="phone" className="field-control" type="tel" required minLength="7" maxLength="40" autoComplete="tel" value={profile.phone || ''} onChange={(event) => setProfile((current) => ({ ...current, phone: event.target.value }))} /></label>
              <label>Email address <span className="field-optional">optional</span><input name="email" className="field-control" type="email" maxLength="254" autoComplete="email" value={profile.email || ''} onChange={(event) => setProfile((current) => ({ ...current, email: event.target.value }))} /></label>
              <label>City<input name="city" className="field-control" type="text" required maxLength="120" autoComplete="address-level2" value={profile.city || ''} onChange={(event) => setProfile((current) => ({ ...current, city: event.target.value }))} /></label>
              <label>Approximate area<input name="approximate_area" className="field-control" type="text" required maxLength="120" placeholder="District or neighborhood" value={profile.approximate_area || ''} onChange={(event) => setProfile((current) => ({ ...current, approximate_area: event.target.value }))} /></label>
              <label>Availability<select name="availability" className="field-control" value={profile.availability || 'temporarily_unavailable'} onChange={(event) => setProfile((current) => ({ ...current, availability: event.target.value }))}><option value="available">Available</option><option value="temporarily_unavailable">Temporarily unavailable</option><option value="do_not_contact">Do not contact</option></select></label>
              <label>Preferred contact<select name="preferred_contact" className="field-control" value={profile.preferred_contact || 'phone'} onChange={(event) => setProfile((current) => ({ ...current, preferred_contact: event.target.value }))}><option value="phone">Phone</option><option value="email">Email</option></select></label>
              <div className="donor-consent-preview"><label><input name="consent_receive_requests" type="checkbox" checked={Boolean(profile.consent_receive_requests)} onChange={(event) => setProfile((current) => ({ ...current, consent_receive_requests: event.target.checked }))} /> I consent to receive voluntary, in-app blood donation requests. I can withdraw this consent at any time.</label><label><input name="consent_share_contact" type="checkbox" checked={Boolean(profile.consent_share_contact)} onChange={(event) => setProfile((current) => ({ ...current, consent_share_contact: event.target.checked }))} /> Separate consent: I allow necessary contact details to be shared with verified hospital or blood-bank personnel only after I accept a request.</label></div>
              <button type="submit" className="button button-primary" disabled={saving}>{saving ? 'Saving privately…' : profileExists ? 'Save profile changes' : 'Register donor profile'}</button>
              <div className="profile-dates"><span>Registration date: {profile.registered_at ? new Date(profile.registered_at).toLocaleString() : 'Set when saved'}</span><span>Last updated: {profile.updated_at ? new Date(profile.updated_at).toLocaleString() : 'Set when saved'}</span></div>
            </form>
            {profileExists && <div className="availability-control"><label htmlFor="availability-quick">Availability toggle</label><select id="availability-quick" className="field-control" value={profile.availability} onChange={(event) => changeAvailability(event.target.value)}><option value="available" disabled={!profile.consent_receive_requests}>Available</option><option value="temporarily_unavailable">Temporarily unavailable</option><option value="do_not_contact">Do not contact</option></select><p className="helper-text">“Available” is self-reported coordination availability, not a blood unit or a medical eligibility determination.</p></div>}
          </section>

          <section className="panel donor-inbox-panel">
            <div className="panel-heading"><div><h2>Request inbox</h2><p>Requests are suggestions based on declared group labels and approximate area. In-app notices only; external SMS/email alerts are not configured.</p></div><HeartHandshake size={18} className="muted-icon" /></div>
            <div className="donor-inbox-controls"><label>Filter status<select className="field-control" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="all">All requests</option><option value="contacted">Awaiting response</option><option value="accepted">Accepted</option><option value="declined">Declined</option><option value="withdrawn">Withdrawn</option></select></label><label>Search<input className="field-control" type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Request, group, or city" /></label></div>
            {!inbox.length && <div className="empty-state"><strong>No request history</strong><p>When a verified hospital request is matched to your consented profile, it will appear here.</p></div>}
            {inbox.length > 0 && !filteredInbox.length && <div className="empty-state"><strong>No requests match these filters</strong><p>Change the search or status filter.</p></div>}
            {filteredInbox.map((notification) => {
              const request = normalizeRequest(notification) || {};
              return <article className="donor-request-card" key={notification.id}>
                <div className="donor-request-heading"><div><strong>{request.request_code || 'Emergency request'}</strong><span className="status-badge">{notification.status}</span></div><span className={`urgency-badge urgency-${request.urgency || 'routine'}`}>{request.urgency || 'Routine'}</span></div>
                <dl className="donor-request-details"><div><dt>Requested</dt><dd>{request.units_requested} units · {String(request.component || '').replaceAll('_', ' ')}</dd></div><div><dt>Group label</dt><dd>{request.blood_group || 'Not provided'}</dd></div><div><dt>Approximate area</dt><dd><MapPin size={13} /> {request.location_city}, {request.approximate_area}</dd></div><div><dt>Required by</dt><dd>{request.required_by ? new Date(request.required_by).toLocaleString() : 'Not provided'}</dd></div></dl>
                <p className="suggestion-reason">{notification.suggestion_reason} This does not establish compatibility or medical eligibility.</p>
                {notification.status === 'contacted' && <div className="button-row"><button type="button" className="button button-primary" disabled={Boolean(busyNotification) || !profile.consent_receive_requests} onClick={() => respond(notification.id, 'accepted')}>{busyNotification === notification.id ? 'Recording…' : 'Accept request'}</button><button type="button" className="button button-secondary" disabled={Boolean(busyNotification)} onClick={() => respond(notification.id, 'declined')}>Decline</button></div>}
                {notification.status !== 'contacted' && <p className="donor-response-note">Response: <strong>{notification.status}</strong>{notification.responded_at ? ` · ${new Date(notification.responded_at).toLocaleString()}` : ''}</p>}
              </article>;
            })}
          </section>
        </div>

        <section className="panel donor-appointments-panel"><div className="panel-heading"><div><h2>Collection appointments</h2><p>Appointments are proposed at verified centres. This does not confirm donation eligibility or collection.</p></div><ShieldCheck size={18} className="muted-icon" /></div>
          {!appointments.length && <div className="empty-state"><strong>No proposed appointments</strong><p>An authorized hospital user may propose a visit after you accept a request.</p></div>}
          {appointments.map((appointment) => {
            const facility = Array.isArray(appointment.authorized_institutions) ? appointment.authorized_institutions[0] : appointment.authorized_institutions;
            const request = Array.isArray(appointment.emergency_blood_requests) ? appointment.emergency_blood_requests[0] : appointment.emergency_blood_requests;
            return <article className="donor-request-card" key={appointment.id}><div className="donor-request-heading"><strong>{request?.request_code || 'Collection visit'}</strong><span className="status-badge">{appointment.status}</span></div><p>{facility?.name || 'Verified licensed facility'} · {facility?.city || 'Location withheld'}</p><p>{new Date(appointment.scheduled_at).toLocaleString()}</p>{appointment.status === 'proposed' && <div className="button-row"><button className="button button-primary" disabled={Boolean(busyNotification)} onClick={() => respondToAppointment(appointment.id, true)}>Confirm visit</button><button className="button button-secondary" disabled={Boolean(busyNotification)} onClick={() => respondToAppointment(appointment.id, false)}>Decline visit</button></div>}</article>;
          })}
        </section>

        {profileExists && <div className="coordination-columns donor-bottom-grid"><section className="panel"><div className="panel-heading"><div><h2>Consent history</h2><p>Consent changes are recorded with a timestamp.</p></div><ShieldCheck size={18} className="muted-icon" /></div>{consentHistory.length ? <div className="consent-event-list">{consentHistory.map((item) => <div key={item.id}><strong>{item.consent_kind === 'receive_requests' ? 'Receive requests' : 'Share contact'}</strong><span>{item.granted ? 'Granted' : 'Withdrawn'} · {new Date(item.recorded_at).toLocaleString()}</span></div>)}</div> : <p className="helper-text">No consent changes were recorded.</p>}</section><section className="panel consent-withdraw-panel"><div className="panel-heading"><div><h2>Stop requests</h2><p>Withdraw both optional consents and stop new outreach.</p></div><UserRoundX size={18} className="muted-icon" /></div><button type="button" className="button button-danger" onClick={withdrawConsent} disabled={!profile.consent_receive_requests && !profile.consent_share_contact}>Withdraw consent and stop requests</button><p className="helper-text">This sets availability to Do Not Contact and withdraws pending in-app notifications.</p></section></div>}
      </>}
    </>}

    <section className="panel donor-demo-panel donor-sandbox-panel"><div className="panel-heading"><div><span className="eyebrow">SAFE, LOCAL TEST PATH</span><h2>Synthetic donor profile sandbox</h2><p>Exercise registration, editing, availability, and consent withdrawal without entering real contact details.</p></div><span className="demo-watermark">BROWSER ONLY</span></div>
      <div className="notice notice-info donor-sandbox-notice"><ShieldCheck size={17} /><div><strong>Use fictional values only</strong><p>This sandbox stays in this browser page, is not written to Supabase, and cannot send SMS, email, or donor requests. Profile registration does not establish donation eligibility.</p></div></div>
      {!sandboxOpen && <button className="button button-secondary" type="button" onClick={() => setSandboxOpen(true)}>Open synthetic profile</button>}
      {sandboxOpen && <>
        <form className="donor-profile-form" onSubmit={saveSandboxProfile}>
          <label>Full name<input className="field-control" required maxLength="120" value={sandboxProfile.full_name} onChange={(event) => setSandboxProfile((current) => ({ ...current, full_name: event.target.value }))} /></label>
          <label>Blood group<select className="field-control" required value={sandboxProfile.blood_group} onChange={(event) => setSandboxProfile((current) => ({ ...current, blood_group: event.target.value }))}>{BLOOD_GROUPS.map((group) => <option key={group}>{group}</option>)}</select></label>
          <label>Sample phone<input className="field-control" type="tel" required minLength="7" maxLength="40" value={sandboxProfile.phone} onChange={(event) => setSandboxProfile((current) => ({ ...current, phone: event.target.value }))} /></label>
          <label>Sample email <span className="field-optional">optional</span><input className="field-control" type="email" maxLength="254" value={sandboxProfile.email} onChange={(event) => setSandboxProfile((current) => ({ ...current, email: event.target.value }))} /></label>
          <label>City<input className="field-control" required maxLength="120" value={sandboxProfile.city} onChange={(event) => setSandboxProfile((current) => ({ ...current, city: event.target.value }))} /></label>
          <label>Approximate area<input className="field-control" required maxLength="120" value={sandboxProfile.approximate_area} onChange={(event) => setSandboxProfile((current) => ({ ...current, approximate_area: event.target.value }))} /></label>
          <label>Availability<select className="field-control" value={sandboxProfile.availability} onChange={(event) => setSandboxProfile((current) => ({ ...current, availability: event.target.value }))}><option value="available">Available</option><option value="temporarily_unavailable">Temporarily unavailable</option><option value="do_not_contact">Do not contact</option></select></label>
          <label>Preferred contact<select className="field-control" value={sandboxProfile.preferred_contact} onChange={(event) => setSandboxProfile((current) => ({ ...current, preferred_contact: event.target.value }))}><option value="phone">Phone</option><option value="email">Email</option></select></label>
          <div className="donor-consent-preview"><label><input type="checkbox" checked={sandboxProfile.consent_receive_requests} onChange={(event) => setSandboxProfile((current) => ({ ...current, consent_receive_requests: event.target.checked }))} /> I consent to simulated voluntary requests.</label><label><input type="checkbox" checked={sandboxProfile.consent_share_contact} onChange={(event) => setSandboxProfile((current) => ({ ...current, consent_share_contact: event.target.checked }))} /> Separate simulated consent to share necessary details with verified staff after accepting.</label></div>
          <div className="button-row form-span-two"><button className="button button-primary" type="submit">{sandboxSaved ? 'Save profile changes' : 'Register synthetic donor'}</button>{sandboxSaved && <button className="button button-danger" type="button" onClick={withdrawSandboxConsent} disabled={!sandboxProfile.consent_receive_requests && !sandboxProfile.consent_share_contact}>Withdraw both consents</button>}</div>
        </form>
        <div className="donor-sandbox-meta" aria-live="polite"><strong>{sandboxSaved ? 'Synthetic profile registered' : 'Sample profile ready to register'}</strong><span>Availability: {sandboxProfile.availability.replaceAll('_', ' ')}</span>{sandboxRegisteredAt && <span>Registered: {new Date(sandboxRegisteredAt).toLocaleString()}</span>}{sandboxUpdatedAt && <span>Last updated: {new Date(sandboxUpdatedAt).toLocaleString()}</span>}</div>
        {sandboxMessage && <p className="inline-success" role="status">{sandboxMessage}</p>}
      </>}
    </section>

    <section className="panel donor-demo-panel"><div className="panel-heading"><div><span className="eyebrow">SYNTHETIC PRESENTATION PATH</span><h2>Interactive donor inbox demo</h2><p>Works without collecting donor details. This simulation is separate from live records.</p></div><span className="demo-watermark">SIMULATED ONLY</span></div>
      {!demoState && <button className="button button-secondary" type="button" disabled={demoBusy} onClick={runDemo}>{demoBusy ? 'Starting…' : 'Open deterministic synthetic inbox'}</button>}
      {demoState && <><div className="demo-watermark">{demoState.simulation_label}</div><p className="helper-text">{demoState.request.units_requested} synthetic units requested; {demoState.inventory_check.accessible_units} synthetic unit accessible; shortfall {demoState.inventory_check.shortfall_units}. No real donor was contacted.</p>{demoState.donor_notifications.map((item) => <article className="donor-request-card" key={item.notification_id}><div className="donor-request-heading"><strong>{demoState.request.id}</strong><span className="status-badge">{item.status}</span></div><dl className="donor-request-details"><div><dt>Requested</dt><dd>{demoState.request.blood_group} · {demoState.request.component}</dd></div><div><dt>Approximate area</dt><dd>{item.area}</dd></div></dl>{item.status === 'contacted' && <div className="button-row"><button type="button" className="button button-primary" disabled={demoBusy || !demoState.next_actions?.includes('accept_donor')} onClick={() => respondDemo('accept_donor', item.donor_id)}>Accept simulated request</button><button type="button" className="button button-secondary" disabled={demoBusy || !demoState.next_actions?.includes('decline_donor')} onClick={() => respondDemo('decline_donor', item.donor_id)}>Decline simulated request</button></div>}</article>)}<p className="privacy-footnote"><ShieldCheck size={15} /> No phone, email, exact address, or GPS is in the synthetic session.</p></>}
    </section>
    {message && <p className="inline-success" role="status">{message}</p>}{error && <p className="inline-error" role="alert">{error}</p>}
  </>;
}
