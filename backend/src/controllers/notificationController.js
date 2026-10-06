import mongoose from 'mongoose';
import Notification from '../models/Notification.js';

const MAX_PAGE = 1_000_000;
const MAX_LIMIT = 100;

function parsePagination(query) {
  const pageValue = query.page ?? '1';
  const limitValue = query.limit ?? '20';
  if (typeof pageValue !== 'string' || !/^\d+$/.test(pageValue)
    || typeof limitValue !== 'string' || !/^\d+$/.test(limitValue)) return null;

  const page = Number(pageValue);
  const limit = Number(limitValue);
  if (!Number.isSafeInteger(page) || page < 1 || page > MAX_PAGE
    || !Number.isSafeInteger(limit) || limit < 1 || limit > MAX_LIMIT) return null;
  return { page, limit, skip: (page - 1) * limit };
}

function notificationView(notification) {
  return {
    id: notification._id.toString(),
    message: notification.message,
    type: notification.type,
    read: notification.read,
    createdAt: notification.createdAt,
    updatedAt: notification.updatedAt,
  };
}

export async function getMyNotifications(req, res, next) {
  const pagination = parsePagination(req.query);
  if (!pagination) {
    return res.status(400).json({ message: 'page and limit must be positive integers; limit cannot exceed 100.' });
  }

  try {
    const filter = { user: req.user._id };
    const [notifications, total] = await Promise.all([
      Notification.find(filter)
        .sort({ createdAt: -1, _id: -1 })
        .skip(pagination.skip)
        .limit(pagination.limit),
      Notification.countDocuments(filter),
    ]);
    return res.json({
      notifications: notifications.map(notificationView),
      pagination: {
        page: pagination.page,
        limit: pagination.limit,
        total,
        totalPages: Math.ceil(total / pagination.limit),
      },
    });
  } catch (error) {
    return next(error);
  }
}

export async function getUnreadCount(req, res, next) {
  try {
    const count = await Notification.countDocuments({ user: req.user._id, read: false });
    return res.json({ count });
  } catch (error) {
    return next(error);
  }
}

export async function markNotificationRead(req, res, next) {
  if (!mongoose.isObjectIdOrHexString(req.params.id)) {
    return res.status(400).json({ message: 'Notification ID is invalid.' });
  }
  try {
    const result = await Notification.updateOne(
      { _id: req.params.id, user: req.user._id },
      { $set: { read: true } },
    );
    if (result.matchedCount !== 1) return res.status(404).json({ message: 'Notification not found.' });
    return res.json({ message: 'Notification marked as read.' });
  } catch (error) {
    return next(error);
  }
}

export async function markAllNotificationsRead(req, res, next) {
  try {
    const result = await Notification.updateMany(
      { user: req.user._id, read: false },
      { $set: { read: true } },
    );
    return res.json({ modifiedCount: result.modifiedCount });
  } catch (error) {
    return next(error);
  }
}
