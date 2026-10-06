const labels = {
  OPEN: 'Open', NEGOTIATING: 'Negotiating', ACCEPTED: 'Accepted',
  IN_PROGRESS: 'In progress', COMPLETED: 'Completed', CANCELLED: 'Cancelled',
  PENDING: 'Pending', REJECTED: 'Rejected', COUNTERED: 'Countered',
};

export default function StatusBadge({ status = 'OPEN' }) {
  return <span className={`status-badge status-${status.toLowerCase()}`}>{labels[status] || status.replaceAll('_', ' ')}</span>;
}
