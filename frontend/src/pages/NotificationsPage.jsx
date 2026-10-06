import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import EmptyState from '../components/EmptyState.jsx';
import ErrorMessage from '../components/ErrorMessage.jsx';
import LoadingSpinner from '../components/LoadingSpinner.jsx';
import NotificationItem from '../components/NotificationItem.jsx';
import { useNotifications } from '../context/NotificationContext.jsx';
import useResource from '../hooks/useResource.js';
import { notificationApi } from '../services/api.js';

function requestTarget(notification) {
  const value = notification.requestId ?? notification.request?.id ?? notification.request?._id;
  const id = typeof value === 'object' && value ? value.id || value._id : value;
  return typeof id === 'string' && id.trim() ? `/requests/${encodeURIComponent(id)}` : null;
}

export default function NotificationsPage() {
  const [page, setPage] = useState(1);
  const [markingId, setMarkingId] = useState('');
  const [markingAll, setMarkingAll] = useState(false);
  const [actionError, setActionError] = useState('');
  const navigate = useNavigate();
  const { unreadCount, setUnreadCount, refreshUnreadCount } = useNotifications();
  const loadNotifications = useCallback(() => notificationApi.list(`page=${page}&limit=20`), [page]);
  const { data, loading, error, reload, setData } = useResource(loadNotifications, [loadNotifications]);
  const notifications = data?.notifications || [];
  const pagination = data?.pagination;

  useEffect(() => { refreshUnreadCount(); }, [refreshUnreadCount]);

  async function markRead(notification) {
    if (notification.read || markingId) return;
    setActionError('');
    setMarkingId(notification.id);
    try {
      await notificationApi.markRead(notification.id);
      setData((current) => current ? { ...current, notifications: current.notifications.map((item) => item.id === notification.id ? { ...item, read: true } : item) } : current);
      setUnreadCount((count) => Math.max(0, count - 1));
      refreshUnreadCount();
      const target = requestTarget(notification);
      if (target) navigate(target);
    } catch {
      setActionError('Unable to mark this notification as read. Please try again.');
    } finally {
      setMarkingId('');
    }
  }

  async function markAllRead() {
    if (markingAll || unreadCount < 1) return;
    setActionError('');
    setMarkingAll(true);
    try {
      await notificationApi.markAllRead();
      setData((current) => current ? { ...current, notifications: current.notifications.map((item) => ({ ...item, read: true })) } : current);
      setUnreadCount(0);
      refreshUnreadCount();
    } catch {
      setActionError('Unable to mark all notifications as read. Please try again.');
    } finally {
      setMarkingAll(false);
    }
  }

  const pageChanging = Boolean(pagination && page !== pagination.page);
  const previousDisabled = loading || pageChanging || !pagination || pagination.page <= 1;
  const nextDisabled = loading || pageChanging || !pagination || pagination.page >= pagination.totalPages;

  return (
    <div className="page-content notifications-page">
      <div className="page-heading notifications-heading">
        <div><span className="eyebrow">STAY IN THE LOOP</span><h1>Notifications</h1><p>Stay updated on your requests, offers, and reviews.</p></div>
        {unreadCount > 0 && <button className="button button-quiet mark-all-button" type="button" onClick={markAllRead} disabled={markingAll || loading}>{markingAll ? 'Marking all…' : 'Mark all as read'}</button>}
      </div>
      {actionError && <ErrorMessage message={actionError} />}
      {loading ? <LoadingSpinner label="Loading notifications…" />
        : error ? <ErrorMessage message="Unable to load notifications. Please try again." onRetry={reload} />
          : notifications.length === 0 ? <EmptyState title="No notifications yet" message="Updates about your requests, offers, fulfillment, and reviews will appear here." />
            : <>
              <div className="notification-list" aria-label="Notifications">
                {notifications.map((notification) => <NotificationItem key={notification.id} notification={notification} busy={markingId === notification.id} onOpen={markRead} />)}
              </div>
              {pagination && <nav className="notification-pagination" aria-label="Notification pages">
                <button className="button button-quiet button-small" type="button" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={previousDisabled}>Previous</button>
                <span>Page {pagination.page} of {pagination.totalPages}</span>
                <button className="button button-quiet button-small" type="button" onClick={() => setPage((current) => current + 1)} disabled={nextDisabled}>Next</button>
              </nav>}
            </>}
    </div>
  );
}
