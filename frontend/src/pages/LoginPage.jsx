import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import ErrorMessage from '../components/ErrorMessage.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { destinationAfterAuth } from '../utils/authNavigation.js';

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await login({ email: form.email.trim(), password: form.password });
      navigate(destinationAfterAuth(location.state?.from), { replace: true });
    } catch (loginError) {
      setError(loginError.message || 'We could not log you in. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="auth-page">
      <section className="auth-card" aria-labelledby="login-title">
        <Link className="auth-brand" to="/" aria-label="HostelGo home"><span className="brand-mark">H</span><span>hostelgo<span className="brand-period">.</span></span></Link>
        <p className="eyebrow">WELCOME BACK</p>
        <h1 id="login-title">Good to see you.</h1>
        <p className="muted">Log in to find a hand around the hostel.</p>
        <ErrorMessage message={error} />
        <form className="form-stack auth-form" onSubmit={submit}>
          <label htmlFor="login-email">Email address
            <input id="login-email" name="email" type="email" autoComplete="email" autoCapitalize="none" spellCheck="false" required value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} placeholder="you@college.edu" />
          </label>
          <div className="auth-field"><label htmlFor="login-password">Password</label>
            <span className="password-control"><input id="login-password" name="password" type={showPassword ? 'text' : 'password'} autoComplete="current-password" required value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} placeholder="Enter your password" /><button className="password-toggle" type="button" aria-label={showPassword ? 'Hide password' : 'Show password'} aria-pressed={showPassword} onClick={() => setShowPassword((visible) => !visible)}>{showPassword ? 'Hide' : 'Show'}</button></span>
          </div>
          <button className="button button-primary button-wide auth-submit" type="submit" disabled={submitting} aria-busy={submitting}>{submitting && <span className="button-spinner" aria-hidden="true" />}{submitting ? 'Logging in…' : 'Log in'}</button>
        </form>
        <p className="auth-switch">New to HostelGo? <Link to="/register" state={location.state}>Create an account</Link></p>
        <p className="auth-footnote"><span aria-hidden="true">✳</span> Good neighbors make a good hostel.</p>
      </section>
    </div>
  );
}
