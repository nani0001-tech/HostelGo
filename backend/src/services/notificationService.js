import Notification from '../models/Notification.js';

export const NOTIFICATION_TYPES = Object.freeze({
  OFFER_RECEIVED: 'OFFER_RECEIVED',
  COUNTER_OFFER: 'COUNTER_OFFER',
  OFFER_ACCEPTED: 'OFFER_ACCEPTED',
  OFFER_REJECTED: 'OFFER_REJECTED',
  FULFILLMENT_STARTED: 'FULFILLMENT_STARTED',
  REQUEST_COMPLETED: 'REQUEST_COMPLETED',
  REQUEST_CANCELLED: 'REQUEST_CANCELLED',
  REVIEW_RECEIVED: 'REVIEW_RECEIVED',
});

const allowedTypes = new Set(Object.values(NOTIFICATION_TYPES));

export async function createNotification({ userId, message, type, session }) {
  if (!userId) throw new TypeError('A notification recipient is required.');
  if (typeof message !== 'string' || !message.trim()) {
    throw new TypeError('A notification message is required.');
  }
  if (!allowedTypes.has(type)) throw new TypeError('Notification type is invalid.');

  const notification = new Notification({ user: userId, message: message.trim(), type });
  await notification.save(session ? { session } : undefined);
  return notification;
}
