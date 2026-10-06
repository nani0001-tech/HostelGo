export default function LoadingSpinner({ label = 'Loading…', compact = false }) {
  return (
    <div className={`loading-state${compact ? ' loading-compact' : ''}`} role="status">
      <span className="spinner" aria-hidden="true" />
      <span>{label}</span>
    </div>
  );
}
