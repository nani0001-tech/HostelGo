import { useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import ErrorMessage from '../components/ErrorMessage.jsx';
import { requestApi } from '../services/api.js';
import { localDateTimeValue, parseQuantity, REQUEST_CATEGORIES, validateCreateRequest } from '../utils/requestValidation.js';

const initialForm = {
  item: '', category: '', quantity: '', reward: '', location: '', requiredTime: '', instructions: '',
};

const categoryLabels = {
  FOOD: 'Food', GROCERIES: 'Groceries', MEDICINE: 'Medicine',
  STATIONERY: 'Stationery', TOOLS: 'Tools', OTHER: 'Other',
};

function FieldError({ id, message }) {
  return message ? <span id={id} className="field-error request-field-error" role="alert">{message}</span> : null;
}

export default function CreateRequestPage() {
  const [form, setForm] = useState(initialForm);
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState('');
  const [saving, setSaving] = useState(false);
  const [minDateTime] = useState(() => localDateTimeValue());
  const submissionLock = useRef(false);
  const navigate = useNavigate();
  const location = useLocation();

  function update(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: '' }));
    setServerError('');
  }

  function fieldProps(field) {
    const errorId = `request-${field}-error`;
    return {
      id: `request-${field}`,
      name: field,
      'aria-invalid': Boolean(errors[field]),
      'aria-describedby': errors[field] ? errorId : undefined,
    };
  }

  async function submit(event) {
    event.preventDefault();
    if (submissionLock.current) return;
    setServerError('');
    const validationErrors = validateCreateRequest(form);
    setErrors(validationErrors);
    const firstInvalid = Object.keys(validationErrors)[0];
    if (firstInvalid) {
      document.getElementById(`request-${firstInvalid}`)?.focus();
      return;
    }

    const parsedQuantity = parseQuantity(form.quantity);
    const instructions = [
      form.instructions.trim(),
      parsedQuantity?.unit ? `Requested quantity: ${parsedQuantity.label}` : '',
    ].filter(Boolean).join('\n\n');
    const payload = {
      item: form.item.trim(),
      category: form.category,
      quantity: parsedQuantity.amount,
      reward: Number(form.reward),
      location: form.location.trim(),
      requiredTime: new Date(form.requiredTime).toISOString(),
      ...(instructions ? { instructions } : {}),
    };

    submissionLock.current = true;
    setSaving(true);
    try {
      const result = await requestApi.create(payload);
      const createdRequestId = result?.request?._id || result?.request?.id;
      if (typeof createdRequestId === 'string' && createdRequestId.trim()) {
        navigate(`/requests/${encodeURIComponent(createdRequestId)}`, { replace: true, state: { requestCreated: true } });
      } else {
        navigate('/my-requests', { replace: true, state: { requestCreated: true } });
      }
    } catch (requestError) {
      if (requestError.status === 401) setServerError('Your session has expired. Please log in again.');
      else setServerError(requestError.message || 'Unable to create the request. Please try again.');
    } finally {
      submissionLock.current = false;
      setSaving(false);
    }
  }

  function cancel() {
    const fromPath = location.state?.from?.pathname;
    navigate(fromPath && fromPath !== '/requests/new' && fromPath !== '/requests/create' ? fromPath : '/my-requests');
  }

  return (
    <div className="page-content narrow-content create-request-page">
      <div className="page-heading"><div><span className="eyebrow">ASK YOUR HOSTEL COMMUNITY</span><h1>Create a Request</h1><p>Tell nearby students what you need and when you need it.</p></div></div>
      <form className="panel form-stack request-form" onSubmit={submit} noValidate aria-busy={saving}>
        <ErrorMessage message={serverError} />

        <label htmlFor="request-item">Item <span className="required-indicator" aria-hidden="true">*</span>
          <input {...fieldProps('item')} type="text" autoComplete="off" maxLength={120} required value={form.item} onChange={(event) => update('item', event.target.value)} placeholder="e.g. Milk and bread" />
          <FieldError id="request-item-error" message={errors.item} />
        </label>

        <label htmlFor="request-category">Category <span className="required-indicator" aria-hidden="true">*</span>
          <select {...fieldProps('category')} required value={form.category} onChange={(event) => update('category', event.target.value)}>
            <option value="">Choose a category</option>
            {REQUEST_CATEGORIES.map((category) => <option key={category} value={category}>{categoryLabels[category]}</option>)}
          </select>
          <FieldError id="request-category-error" message={errors.category} />
        </label>

        <label htmlFor="request-quantity">Quantity <span className="required-indicator" aria-hidden="true">*</span>
          <input {...fieldProps('quantity')} type="text" inputMode="text" autoComplete="off" maxLength={60} required value={form.quantity} onChange={(event) => update('quantity', event.target.value)} placeholder="e.g. 2 packets, 1 bottle, 500g" />
          <span className="field-hint">Include a number and unit, such as “2 packets” or “500g”.</span>
          <FieldError id="request-quantity-error" message={errors.quantity} />
        </label>

        <div className="form-row request-form-row">
          <label htmlFor="request-reward">Reward <span className="required-indicator" aria-hidden="true">*</span>
            <span className="currency-input"><span aria-hidden="true">₹</span><input {...fieldProps('reward')} type="number" inputMode="decimal" min="0" max="100000" step="0.01" required value={form.reward} onChange={(event) => update('reward', event.target.value)} placeholder="0.00" /></span>
            <FieldError id="request-reward-error" message={errors.reward} />
          </label>
          <label htmlFor="request-location">Location <span className="required-indicator" aria-hidden="true">*</span>
            <input {...fieldProps('location')} type="text" maxLength={120} required value={form.location} onChange={(event) => update('location', event.target.value)} placeholder="Hostel Block A" />
            <FieldError id="request-location-error" message={errors.location} />
          </label>
        </div>

        <label htmlFor="request-requiredTime">Required time <span className="required-indicator" aria-hidden="true">*</span>
          <input {...fieldProps('requiredTime')} type="datetime-local" min={minDateTime} required value={form.requiredTime} onChange={(event) => update('requiredTime', event.target.value)} />
          <span className="field-hint">Times are shown in your device’s local timezone.</span>
          <FieldError id="request-requiredTime-error" message={errors.requiredTime} />
        </label>

        <label htmlFor="request-instructions">Instructions <span className="optional">Optional</span>
          <textarea {...fieldProps('instructions')} rows="4" maxLength={500} value={form.instructions} onChange={(event) => update('instructions', event.target.value)} placeholder="Please buy any brand of milk. Call me when you reach the hostel." />
          <span className="field-hint">{form.instructions.length}/500 characters</span>
          <FieldError id="request-instructions-error" message={errors.instructions} />
        </label>

        <div className="form-actions">
          <button className="button button-quiet" type="button" onClick={cancel} disabled={saving}>Cancel</button>
          <button className="button button-primary" type="submit" disabled={saving} aria-busy={saving}>
            {saving && <span className="button-spinner" aria-hidden="true" />}{saving ? 'Creating…' : 'Create Request'}
          </button>
        </div>
      </form>
    </div>
  );
}
