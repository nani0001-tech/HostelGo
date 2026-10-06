import mongoose from 'mongoose';
import Offer from '../models/Offer.js';
import Request from '../models/Request.js';
import Review from '../models/Review.js';
import User from '../models/User.js';
import { createNotification, NOTIFICATION_TYPES } from '../services/notificationService.js';

const SAFE_USER_FIELDS = 'name rating ratingCount profileImage';
const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 100;
const MAX_PAGE = 1_000_000;

function httpError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function sameId(left, right) {
  return left?.toString() === right?.toString();
}

function safeUser(user) {
  if (!user) return null;
  return {
    id: user._id.toString(),
    name: user.name,
    rating: user.rating,
    ratingCount: user.ratingCount,
    ...(user.profileImage ? { profileImage: user.profileImage } : {}),
  };
}

function presentReview(review) {
  return {
    id: review._id.toString(),
    reviewer: safeUser(review.reviewer),
    ...(review.reviewedUser ? { reviewedUser: safeUser(review.reviewedUser) } : {}),
    rating: review.rating,
    ...(review.comment ? { comment: review.comment } : {}),
    request: review.request ? {
      id: review.request._id.toString(),
      item: review.request.item,
      category: review.request.category,
    } : null,
    createdAt: review.createdAt,
  };
}

function pagination(query) {
  const page = query.page === undefined ? 1 : Number(query.page);
  const limit = query.limit === undefined ? DEFAULT_LIMIT : Number(query.limit);
  if (!Number.isSafeInteger(page) || page < 1 || page > MAX_PAGE
    || !Number.isSafeInteger(limit) || limit < 1) {
    throw httpError(400, 'Page and limit must be positive integers.');
  }
  return { page, limit: Math.min(limit, MAX_LIMIT) };
}

async function getReviewContext(requestId, userId) {
  if (!mongoose.isObjectIdOrHexString(requestId)) return { reason: 'INVALID_REQUEST' };
  const request = await Request.findById(requestId).select('requester acceptedOffer status');
  if (!request) return { reason: 'INVALID_REQUEST' };
  if (request.status !== 'COMPLETED') return { reason: 'NOT_COMPLETED', request };

  if (!request.acceptedOffer) return { reason: 'INVALID_REQUEST', request };
  const offer = await Offer.findById(request.acceptedOffer).select('request helper status');
  if (!offer || !sameId(offer.request, request._id) || offer.status !== 'ACCEPTED') {
    return { reason: 'INVALID_REQUEST', request };
  }

  let reviewedUserId;
  if (sameId(userId, request.requester)) reviewedUserId = offer.helper;
  else if (sameId(userId, offer.helper)) reviewedUserId = request.requester;
  else return { reason: 'NOT_PARTICIPANT', request };

  if (sameId(userId, reviewedUserId)) return { reason: 'SELF_REVIEW', request };
  const reviewedUser = await User.findById(reviewedUserId).select(SAFE_USER_FIELDS);
  if (!reviewedUser) return { reason: 'INVALID_REQUEST', request };
  const existing = await Review.exists({ request: request._id, reviewer: userId });
  if (existing) return { reason: 'ALREADY_REVIEWED', request, reviewedUser };
  return { request, reviewedUser };
}

function sendReviewError(error, res, next) {
  if (error.statusCode) return res.status(error.statusCode).json({ message: error.message });
  if (error.code === 11000) return res.status(409).json({ message: 'You have already reviewed this request.' });
  if (error.name === 'ValidationError' || error.name === 'CastError') {
    return res.status(400).json({ message: 'Review data is invalid.' });
  }
  return next(error);
}

export async function createReview(req, res, next) {
  const { requestId, rating, comment } = req.body || {};
  const allowedKeys = new Set(['requestId', 'rating', 'comment']);
  if (Object.keys(req.body || {}).some((key) => !allowedKeys.has(key))) {
    return res.status(400).json({ message: 'Only requestId, rating, and comment are accepted.' });
  }
  if (!mongoose.isObjectIdOrHexString(requestId)) {
    return res.status(400).json({ message: 'Request ID is invalid.' });
  }
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return res.status(400).json({ message: 'Rating must be an integer from 1 to 5.' });
  }
  if (comment !== undefined && typeof comment !== 'string') {
    return res.status(400).json({ message: 'Comment must be a string.' });
  }

  let session;
  try {
    session = await mongoose.startSession();
    let reviewId;
    await session.withTransaction(async () => {
      const request = await Request.findById(requestId).select('requester acceptedOffer status').session(session);
      if (!request) throw httpError(404, 'Request not found.');
      if (request.status !== 'COMPLETED') throw httpError(409, 'Reviews are available after request completion.');
      if (!request.acceptedOffer) throw httpError(409, 'The accepted helper is unavailable.');

      const offer = await Offer.findById(request.acceptedOffer).select('request helper status').session(session);
      if (!offer || !sameId(offer.request, request._id) || offer.status !== 'ACCEPTED') {
        throw httpError(409, 'The accepted helper is unavailable.');
      }

      let reviewedUserId;
      if (sameId(req.user._id, request.requester)) reviewedUserId = offer.helper;
      else if (sameId(req.user._id, offer.helper)) reviewedUserId = request.requester;
      else throw httpError(403, 'Only a request participant can leave a review.');
      if (sameId(req.user._id, reviewedUserId)) throw httpError(409, 'You cannot review yourself.');

      const target = await User.findById(reviewedUserId).select('rating ratingCount').session(session);
      if (!target) throw httpError(404, 'The reviewed user is unavailable.');
      if (await Review.exists({ request: request._id, reviewer: req.user._id }).session(session)) {
        throw httpError(409, 'You have already reviewed this request.');
      }

      const [created] = await Review.create([{
        request: request._id,
        reviewer: req.user._id,
        reviewedUser: target._id,
        rating,
        ...(comment === undefined ? {} : { comment: comment.trim() }),
      }], { session });
      reviewId = created._id;

      const count = target.ratingCount || 0;
      const priorHundredths = Math.round((target.rating || 0) * 100) * count;
      const updatedAverage = Math.round((priorHundredths + rating * 100) / (count + 1)) / 100;
      await User.updateOne(
        { _id: target._id },
        { $set: { rating: updatedAverage, ratingCount: count + 1 } },
        { session, runValidators: true },
      );
      await createNotification({
        userId: target._id,
        message: 'You received a new review.',
        type: NOTIFICATION_TYPES.REVIEW_RECEIVED,
        session,
      });
    });

    const createdReview = await Review.findById(reviewId)
      .populate({ path: 'reviewer', select: SAFE_USER_FIELDS })
      .populate({ path: 'reviewedUser', select: SAFE_USER_FIELDS })
      .populate({ path: 'request', select: 'item category' });
    return res.status(201).json({ review: presentReview(createdReview) });
  } catch (error) {
    return sendReviewError(error, res, next);
  } finally {
    if (session) await session.endSession();
  }
}

export async function getUserReviews(req, res, next) {
  if (!mongoose.isObjectIdOrHexString(req.params.userId)) {
    return res.status(400).json({ message: 'User ID is invalid.' });
  }
  try {
    const target = await User.findById(req.params.userId).select('_id');
    if (!target) return res.status(404).json({ message: 'User not found.' });
    const { page, limit } = pagination(req.query);
    const filter = { reviewedUser: target._id };
    const [reviews, total] = await Promise.all([
      Review.find(filter)
        .sort({ createdAt: -1, _id: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate({ path: 'reviewer', select: SAFE_USER_FIELDS })
        .populate({ path: 'request', select: 'item category' }),
      Review.countDocuments(filter),
    ]);
    return res.json({
      reviews: reviews.map(presentReview),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    return sendReviewError(error, res, next);
  }
}

export async function getMyReviews(req, res, next) {
  try {
    const { page, limit } = pagination(req.query);
    const filter = { reviewer: req.user._id };
    const [reviews, total] = await Promise.all([
      Review.find(filter)
        .sort({ createdAt: -1, _id: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate({ path: 'reviewedUser', select: SAFE_USER_FIELDS })
        .populate({ path: 'request', select: 'item category' }),
      Review.countDocuments(filter),
    ]);
    return res.json({
      reviews: reviews.map(presentReview),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    return sendReviewError(error, res, next);
  }
}

export async function canReviewRequest(req, res, next) {
  try {
    const result = await getReviewContext(req.params.requestId, req.user._id);
    if (result.reason) return res.json({ canReview: false, reason: result.reason });
    return res.json({ canReview: true, reviewedUser: safeUser(result.reviewedUser) });
  } catch (error) {
    return sendReviewError(error, res, next);
  }
}
