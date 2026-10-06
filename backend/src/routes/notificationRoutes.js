import { Router } from 'express';
import {
  getMyNotifications,
  getUnreadCount,
  markAllNotificationsRead,
  markNotificationRead,
} from '../controllers/notificationController.js';
import authMiddleware from '../middleware/authMiddleware.js';

const router = Router();

router.use(authMiddleware);
router.get('/unread-count', getUnreadCount);
router.put('/read-all', markAllNotificationsRead);
router.put('/:id/read', markNotificationRead);
router.get('/', getMyNotifications);

export default router;
