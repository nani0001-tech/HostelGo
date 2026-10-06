import { useState } from 'react';

function reviewErrorMessage(error) {
  if (error?.status === 401) return 'Your session has expired. Please log in again.';
  if (error?.status === 403) return 'You are not eligible to review this request.';
  if (error?.status === 404) return 'This request is no longer available.';
  if (error?.status === 409) return 'You have already reviewed this request.';
  if (error?.status === 400) return 'Please choose a rating from 1 to 5 and try again.';
  if (!error?.status) return 'Unable to connect to HostelGo. Check your connection and try again.';
  return 'Unable to submit your review. Please try again.';
}

export default function ReviewForm({ onSubmit }) {
  const [rating, setRating] = useState(null);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  async function submit(event) {
    event.preventDefault();
    setError('');
    if (rating === null) {
      setError('Please select a rating.');
      return;
    }
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      setError('Rating must be between 1 and 5.');
      return;
    }
    setSubmitting(true);
    try {
      await onSubmit({ rating, ...(comment.trim() ? { comment: comment.trim() } : {}) });
    } catch (submitError) {
      setError(reviewErrorMessage(submitError));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="review-form" onSubmit={submit} noValidate>
      <fieldset className="rating-fieldset" aria-describedby={error ? 'review-rating-error' : undefined}>
        <legend>How was your experience?</legend>
        <div className="rating-star-options">
          {[1, 2, 3, 4, 5].map((value) => (
            <label className="rating-star-choice" key={value}>
              <input type="radio" name="review-rating" value={value} checked={rating === value} onChange={() => setRating(value)} disabled={submitting} />
              <span className="rating-star-glyph" aria-hidden="true">{rating !== null && value <= rating ? '★' : '☆'}</span>
              <span className="sr-only">{value} {value === 1 ? 'star' : 'stars'}</span>
            </label>
          ))}
        </div>
        <span className="selected-rating" aria-live="polite">{rating ? `${rating} out of 5` : 'Select 1 to 5 stars'}</span>
        {error && <span className="review-field-error" id="review-rating-error" role="alert">{error}</span>}
      </fieldset>
      <label className="review-comment-label" htmlFor="review-comment">Comment <span className="optional">Optional</span>
        <textarea id="review-comment" name="comment" rows="4" value={comment} onChange={(event) => setComment(event.target.value)} placeholder="Share a few words about your experience." disabled={submitting} />
      </label>
      <button className="button button-primary" type="submit" disabled={submitting}>{submitting ? 'Submitting…' : 'Submit Review'}</button>
    </form>
  );
}
