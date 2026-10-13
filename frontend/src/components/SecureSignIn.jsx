import { useState } from 'react';
import { KeyRound, Mail, Smartphone } from 'lucide-react';

/** OTP sign-in avoids adding locally managed passwords to donor records. */
export default function SecureSignIn({ client, allowCreate = true, title = 'Sign in securely' }) {
  const [contact, setContact] = useState('');
  const [code, setCode] = useState('');
  const [channel, setChannel] = useState('phone');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const requestCode = async (event) => {
    event.preventDefault(); setBusy(true); setError(''); setMessage('');
    try {
      const credentials = channel === 'email' ? { email: contact.trim() } : { phone: contact.trim() };
      const { error: issue } = await client.auth.signInWithOtp({
        ...credentials,
        options: { shouldCreateUser: allowCreate },
      });
      if (issue) throw issue;
      setSent(true);
      setMessage(`A one-time code was requested through ${channel}. Check the configured delivery service.`);
    } catch (issue) { setError(issue.message || 'The sign-in code could not be sent.'); }
    finally { setBusy(false); }
  };

  const verifyCode = async (event) => {
    event.preventDefault(); setBusy(true); setError(''); setMessage('');
    try {
      const credentials = channel === 'email'
        ? { email: contact.trim(), token: code.trim(), type: 'email' }
        : { phone: contact.trim(), token: code.trim(), type: 'sms' };
      const { error: issue } = await client.auth.verifyOtp(credentials);
      if (issue) throw issue;
      setMessage('Identity verified for this browser session.');
    } catch (issue) { setError(issue.message || 'The code could not be verified.'); }
    finally { setBusy(false); }
  };

  return <section className="panel secure-signin-panel">
    <div className="panel-heading"><div><h2>{title}</h2><p>{allowCreate ? 'Donor accounts use email or SMS one-time codes.' : 'Hospital and staff accounts must be created and approved by an administrator.'}</p></div><KeyRound size={18} className="muted-icon" /></div>
    <form className="secure-signin-form" onSubmit={sent ? verifyCode : requestCode}>
      <label>Code delivery method<select className="field-control" value={channel} onChange={(event) => { setChannel(event.target.value); setSent(false); setCode(''); }}><option value="phone">SMS to phone</option><option value="email">Email</option></select></label>
      <label>{channel === 'email' ? <><Mail size={13} /> Email address</> : <><Smartphone size={13} /> Phone number</>}<input className="field-control" type={channel === 'email' ? 'email' : 'tel'} required autoComplete={channel === 'email' ? 'email' : 'tel'} value={contact} onChange={(event) => setContact(event.target.value)} /></label>
      {sent && <label>One-time code<input className="field-control" inputMode="numeric" autoComplete="one-time-code" minLength="4" maxLength="10" required value={code} onChange={(event) => setCode(event.target.value)} /></label>}
      <button className="button button-primary" disabled={busy}>{busy ? 'Please wait…' : sent ? 'Verify code' : 'Send one-time code'}</button>
    </form>
    {message && <p className="inline-success" role="status">{message}</p>}{error && <p className="inline-error" role="alert">{error}</p>}
  </section>;
}
