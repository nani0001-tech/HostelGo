import { formatDateTime } from '../utils/formatters.js';

const TYPE_LABELS = {
  OFFER_RECEIVED: 'New Offer',
  COUNTER_OFFER: 'Counter Offer',
  OFFER_ACCEPTED: 'Offer Accepted',
  OFFER_REJECTED: 'Offer Rejected',
  FULFILLMENT_STARTED: 'Fulfillment Started',
  REQUEST_COMPLETED: 'Request Completed',
  REQUEST_CANCELLED: 'Request Cancelled',
  REVIEW_RECEIVED: 'New Review',
};

const TYPE_ICONS = {
  OFFER_RECEIVED: '↗', COUNTER_OFFER: '↔', OFFER_ACCEPTED: '✓', OFFER_REJECTED: '×',
  FULFILLMENT_STARTED: '→', REQUEST_COMPLETED: '✓', REQUEST_CANCELLED: '!', REVIEW_RECEIVED: '★',
};

function notificationTitle(type) {
  return TYPE_LABELS[type] || (type ? type.toLowerCase().replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase()) : 'Update');
}

export default function NotificationItem({ notification, busy, onOpen }) {
  const title = notificationTitle(notification.type);
  const content = <>
    <strong>{title}</strong>
    {!notification.read && <span className="notification-unread-label">Unread</span>}
    <p>{notification.message}</p>
    <time dateTime={notification.createdAt}>{formatDateTime(notification.createdAt)}</time>
  </>;
  return (
    <article className={`notification-row${notification.read ? '' : ' notification-unread'}`}>
      <span className="notification-icon" aria-hidden="true">{TYPE_ICONS[notification.type] || '•'}</span>
      {notification.read ? <div className="notification-copy">{content}</div>
        : <button className="notification-copy notification-content-button" type="button" onClick={() => onOpen(notification)} disabled={busy} aria-label={`Mark as read: ${title}`}>
          {content}<span className="notification-open-label">{busy ? 'Marking…' : 'Mark as read'}</span>
        </button>}
    </article>
  );
}
