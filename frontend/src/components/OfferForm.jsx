import { useState } from 'react';
import { formatCurrency } from '../utils/formatters.js';

export function friendlyOfferError(error) {
  if (error?.status === 401) return 'Your session has expired. Please log in again.';
  if (error?.status === 403) return 'You are not allowed to perform this action.';
  if (error?.status === 404) return 'This request or offer is no longer available.';
  if (error?.status === 409) return 'This offer is no longer available. Refresh the page to see the latest status.';
  if (error?.status === 400) return 'Check the price and message, then try again.';
  if (error?.status >= 500) return 'Something went wrong on our end. Please try again in a moment.';
  if (!error?.status) return error?.message || 'Unable to complete this action. Check your connection and try again.';
  return 'Unable to complete this action. Please try again.';
}

export default function OfferForm({
  onSubmit,
  submitting = false,
  submitLabel = 'Make Offer',
  submittingLabel = 'Submitting…',
  initialPrice = '',
  initialMessage = '',
  reward,
}) {
  const [price, setPrice] = useState(String(initialPrice));
  const [message, setMessage] = useState(initialMessage);
  const [validationError, setValidationError] = useState('');

  async function handleSubmit(event) {
    event.preventDefault();
    setValidationError('');
    if (price.trim() === '') {
      setValidationError('Enter a proposed price.');
      return;
    }
    const proposedPrice = Number(price);
    if (!Number.isFinite(proposedPrice) || proposedPrice < 0) {
      setValidationError('Enter a valid price of zero or more.');
      return;
    }
    await onSubmit({ proposedPrice, ...(message.trim() ? { message: message.trim() } : {}) });
  }

  return (
    <form className="form-stack offer-form" onSubmit={handleSubmit} noValidate>
      {reward != null && <p className="offer-reward-line">Request reward <strong>{formatCurrency(reward)}</strong></p>}
      <label htmlFor="offer-price">Proposed price (₹)<input id="offer-price" name="proposedPrice" type="number" inputMode="decimal" min="0" step="any" required value={price} onChange={(event) => setPrice(event.target.value)} aria-invalid={Boolean(validationError)} aria-describedby={validationError ? 'offer-price-error' : undefined} disabled={submitting} /></label>
      {validationError && <p className="offer-field-error" id="offer-price-error" role="alert">{validationError}</p>}
      <label htmlFor="offer-message">Message <span className="optional">Optional</span><textarea id="offer-message" name="message" rows="3" value={message} onChange={(event) => setMessage(event.target.value)} placeholder="I can buy this and bring it to the hostel." disabled={submitting} /></label>
      <button className="button button-primary button-wide" type="submit" disabled={submitting}>{submitting ? submittingLabel : submitLabel}</button>
    </form>
  );
}
