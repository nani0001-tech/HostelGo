export default function RatingDisplay({ rating, count = 0, compact = false }) {
  const reviewCount = Number(count) || 0;
  if (reviewCount < 1) return <span className={`rating-display${compact ? ' rating-display-compact' : ''}`}>No reviews yet</span>;
  const score = Number(rating);
  return (
    <span className={`rating-display${compact ? ' rating-display-compact' : ''}`}>
      <strong>{Number.isFinite(score) ? score.toFixed(1) : '0.0'} <span aria-hidden="true">★</span></strong>
      <span>Based on {reviewCount} {reviewCount === 1 ? 'review' : 'reviews'}</span>
    </span>
  );
}
