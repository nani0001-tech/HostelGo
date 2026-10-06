import { Link } from 'react-router-dom';

export default function EmptyState({ icon = '✦', title, message, action, to }) {
  return (
    <div className="empty-state">
      <span className="empty-icon" aria-hidden="true">{icon}</span>
      <h3>{title}</h3>
      {message && <p>{message}</p>}
      {action && (to
        ? <Link className="button button-primary button-small" to={to}>{action}</Link>
        : <button className="button button-primary button-small" type="button" onClick={action.onClick}>{action.label}</button>)}
    </div>
  );
}
