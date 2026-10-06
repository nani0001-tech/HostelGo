import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { notificationApi } from '../services/api.js';

const NotificationContext = createContext({ unreadCount: 0, loading: false, refreshUnreadCount: async () => 0, setUnreadCount: () => {} });

export function NotificationProvider({ enabled, children }) {
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const refreshUnreadCount = useCallback(async () => {
    if (!enabled) {
      setUnreadCount(0);
      setLoading(false);
      return 0;
    }
    setLoading(true);
    try {
      const response = await notificationApi.unreadCount();
      const count = Number.isSafeInteger(response.count) && response.count > 0 ? response.count : 0;
      setUnreadCount(count);
      return count;
    } catch {
      // A badge failure must not affect navigation or the rest of the application.
      setUnreadCount(0);
      return 0;
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    if (enabled) refreshUnreadCount();
    else setUnreadCount(0);
  }, [enabled, refreshUnreadCount]);

  const value = useMemo(() => ({ unreadCount, loading, setUnreadCount, refreshUnreadCount }), [unreadCount, loading, refreshUnreadCount]);
  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>;
}

export function useNotifications() {
  return useContext(NotificationContext);
}
