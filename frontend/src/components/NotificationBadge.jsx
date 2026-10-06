import { useNotifications } from '../context/NotificationContext.jsx';

export default function NotificationBadge() {
  const { unreadCount } = useNotifications();
  return unreadCount > 0 ? <span className="notification-badge" aria-label={`${unreadCount} unread notifications`}>{unreadCount > 99 ? '99+' : unreadCount}</span> : null;
}
