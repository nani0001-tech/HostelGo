import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import ErrorMessage from '../components/ErrorMessage.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { validateRegistration } from '../utils/authValidation.js';
import { destinationAfterAuth } from '../utils/authNavigation.js';

function FieldError({ id, children }) {
  return children ? <span className="field-error" id={id} role="alert">{children}</span> : null;
}

export default function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ name: '', email: '', password: '', confirmPassword: '', phone: '', hostel: '' });
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showPasswords, setShowPasswords] = useState(false);

  function update(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: '' }));
  }

  async function submit(event) {
    event.preventDefault();
    setServerError('');
    const validationErrors = validateRegistration(form);
    setErrors(validationErrors);
    const firstInvalid = Object.keys(validationErrors)[0];
    if (firstInvalid) {
      document.getElementById(`register-${firstInvalid}`)?.focus();
      return;
    }

    setSubmitting(true);
    try {
      await register({
        name: form.name.trim(), email: form.email.trim().toLowerCase(), password: form.password,
        ...(form.phone.trim() ? { phone: form.phone.trim() } : {}), hostel: form.hostel.trim(),
      });
      navigate(destinationAfterAuth(location.state?.from), { replace: true });
    } catch (registerError) {
      setServerError(registerError.message || 'We could not create your account. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  function fieldProps(field) {
    const errorId = `register-${field}-error`;
    return {
      id: `register-${field}`,
      name: field,
      'aria-invalid': Boolean(errors[field]),
      'aria-describedby': errors[field] ? errorId : undefined,
    };
  }

  return (
    <div className="auth-page auth-page-register">
      <section className="auth-card auth-card-register" aria-labelledby="register-title">
        <Link className="auth-brand" to="/" aria-label="HostelGo home"><span className="brand-mark">H</span><span>hostelgo<span className="brand-period">.</span></span></Link>
        <p className="eyebrow">JOIN YOUR CAMPUS COMMUNITY</p>
        <h1 id="register-title">Let’s get you started.</h1>
        <p className="muted">One account for all the little things.</p>
        <ErrorMessage message={serverError} />
        <form className="form-stack auth-form" onSubmit={submit} noValidate>
          <label htmlFor="register-name">Your name
            <input {...fieldProps('name')} autoComplete="name" maxLength={80} required value={form.name} onChange={(event) => update('name', event.target.value)} placeholder="Student name" />
            <FieldError id="register-name-error">{errors.name}</FieldError>
          </label>
          <label htmlFor="register-email">Email address
            <input {...fieldProps('email')} type="email" autoComplete="email" autoCapitalize="none" spellCheck="false" required value={form.email} onChange={(event) => update('email', event.target.value)} placeholder="you@college.edu" />
            <FieldError id="register-email-error">{errors.email}</FieldError>
          </label>
          <div className="auth-field"><label htmlFor="register-password">Password</label>
            <span className="password-control"><input {...fieldProps('password')} type={showPasswords ? 'text' : 'password'} autoComplete="new-password" minLength={8} required value={form.password} onChange={(event) => update('password', event.target.value)} placeholder="At least 8 characters" /><button className="password-toggle" type="button" aria-label={showPasswords ? 'Hide password' : 'Show password'} aria-pressed={showPasswords} onClick={() => setShowPasswords((visible) => !visible)}>{showPasswords ? 'Hide' : 'Show'}</button></span>
            <FieldError id="register-password-error">{errors.password}</FieldError>
          </div>
          <div className="auth-field"><label htmlFor="register-confirmPassword">Confirm password</label>
            <span className="password-control"><input {...fieldProps('confirmPassword')} type={showPasswords ? 'text' : 'password'} autoComplete="new-password" required value={form.confirmPassword} onChange={(event) => update('confirmPassword', event.target.value)} placeholder="Enter your password again" /><button className="password-toggle" type="button" aria-label={showPasswords ? 'Hide password' : 'Show password'} aria-pressed={showPasswords} onClick={() => setShowPasswords((visible) => !visible)}>{showPasswords ? 'Hide' : 'Show'}</button></span>
            <FieldError id="register-confirmPassword-error">{errors.confirmPassword}</FieldError>
          </div>
          <div className="form-row auth-form-row">
            <label htmlFor="register-phone">Phone <span className="optional">Optional</span>
              <input {...fieldProps('phone')} type="tel" autoComplete="tel" inputMode="tel" value={form.phone} onChange={(event) => update('phone', event.target.value)} placeholder="Your number" />
              <FieldError id="register-phone-error">{errors.phone}</FieldError>
            </label>
            <label htmlFor="register-hostel">Hostel
              <input {...fieldProps('hostel')} autoComplete="organization" maxLength={80} required value={form.hostel} onChange={(event) => update('hostel', event.target.value)} placeholder="Your hostel name" />
              <FieldError id="register-hostel-error">{errors.hostel}</FieldError>
            </label>
          </div>
          <button className="button button-primary button-wide auth-submit" type="submit" disabled={submitting} aria-busy={submitting}>{submitting && <span className="button-spinner" aria-hidden="true" />}{submitting ? 'Creating account…' : 'Create account'}</button>
        </form>
        <p className="auth-switch">Already have an account? <Link to="/login" state={location.state}>Log in</Link></p>
        <p className="auth-footnote"><span aria-hidden="true">✳</span> Built for student life.</p>
      </section>
    </div>
  );
}
