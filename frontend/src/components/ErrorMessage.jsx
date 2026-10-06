export default function ErrorMessage({ message, onRetry }) {
  if (!message) return null;
  return (
    <div className="error-message" role="alert">
      <span>{message}</span>
      {onRetry && <button className="text-button" type="button" onClick={onRetry}>Try again</button>}
    </div>
  );
}
