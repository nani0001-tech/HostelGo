import { formatDateTime } from '../utils/formatters.js';

export default function ReviewCard({ review, mode = 'received' }) {
  const rating = Number(review.rating);
  const person = mode === 'authored' ? review.reviewedUser : review.reviewer;
  const personLabel = mode === 'authored' ? `Reviewed ${person?.name || 'a student'}` : person?.name || 'HostelGo student';
  return (
    <article className="review-card">
      <div className="review-card-heading">
        <span className="review-card-rating" role="img" aria-label={`${rating} out of 5 stars`}>
          <span aria-hidden="true">{'★'.repeat(Math.max(0, Math.min(5, rating)))}{'☆'.repeat(Math.max(0, 5 - rating))}</span>
          <strong>{rating}/5</strong>
        </span>
        {review.createdAt && <time dateTime={review.createdAt}>{formatDateTime(review.createdAt)}</time>}
      </div>
      {review.comment && <p className="review-card-comment">“{review.comment}”</p>}
      <div className="review-card-footer">
        <strong>{personLabel}</strong>
        {review.request?.item && <span>For {review.request.item}</span>}
      </div>
    </article>
  );
}
