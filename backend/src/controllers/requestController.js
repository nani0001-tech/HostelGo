import mongoose from 'mongoose';
import Offer from '../models/Offer.js';
import Request, { REQUEST_CATEGORIES } from '../models/Request.js';
import { transitionRequestStatus } from '../services/requestStatus.js';
import { populateRequestDetails } from '../services/requestView.js';
import { createNotification, NOTIFICATION_TYPES } from '../services/notificationService.js';

const REQUESTER_FIELDS = 'name rating ratingCount hostel profileImage';
const REQUEST_FIELDS = new Set([
  'item',
  'category',
  'quantity',
  'reward',
  'location',
  'requiredTime',
  'instructions',
]);
const EDITABLE_STATUSES = ['OPEN', 'NEGOTIATING'];
const MAX_PAGE = 1_000_000;
const MAX_LIMIT = 100;

function validRequestId(id) {
  return mongoose.isObjectIdOrHexString(id);
}

function parsePagination(query) {
  const pageValue = query.page ?? '1';
  const limitValue = query.limit ?? '10';
  if (typeof pageValue !== 'string' || !/^\d+$/.test(pageValue)
    || typeof limitValue !== 'string' || !/^\d+$/.test(limitValue)) {
    return null;
  }

  const page = Number(pageValue);
  const limit = Number(limitValue);
  if (!Number.isSafeInteger(page) || page < 1 || page > MAX_PAGE
    || !Number.isSafeInteger(limit) || limit < 1 || limit > MAX_LIMIT) {
    return null;
  }

  return { page, limit, skip: (page - 1) * limit };
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function validateRequestInput(body, { partial = false } = {}) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { error: 'Request body must be a JSON object.' };
  }

  const unsupportedFields = Object.keys(body).filter((field) => !REQUEST_FIELDS.has(field));
  if (unsupportedFields.length > 0) {
    return { error: `Unsupported request field: ${unsupportedFields[0]}.` };
  }

  const values = {};
  const provided = (field) => Object.hasOwn(body, field);
  const requiredFields = ['item', 'category', 'quantity', 'reward', 'location', 'requiredTime'];

  if (!partial) {
    const missingField = requiredFields.find((field) => !provided(field));
    if (missingField) {
      return { error: `${missingField} is required.` };
    }
  } else if (Object.keys(body).length === 0) {
    return { error: 'Provide at least one field to update.' };
  }

  if (provided('item')) {
    if (typeof body.item !== 'string' || body.item.trim().length === 0) {
      return { error: 'item must be a non-empty string.' };
    }
    values.item = body.item.trim();
  }

  if (provided('category')) {
    if (typeof body.category !== 'string' || body.category.trim().length === 0) {
      return { error: 'category must be a non-empty string.' };
    }
    const category = body.category.trim().toUpperCase();
    if (!REQUEST_CATEGORIES.includes(category)) {
      return { error: `category must be one of: ${REQUEST_CATEGORIES.join(', ')}.` };
    }
    values.category = category;
  }

  if (provided('quantity')) {
    if (!Number.isInteger(body.quantity) || body.quantity <= 0) {
      return { error: 'quantity must be a positive integer.' };
    }
    values.quantity = body.quantity;
  }

  if (provided('reward')) {
    if (typeof body.reward !== 'number' || !Number.isFinite(body.reward) || body.reward < 0) {
      return { error: 'reward must be a non-negative number.' };
    }
    values.reward = body.reward;
  }

  if (provided('location')) {
    if (typeof body.location !== 'string' || body.location.trim().length === 0) {
      return { error: 'location must be a non-empty string.' };
    }
    values.location = body.location.trim();
  }

  if (provided('requiredTime')) {
    if (typeof body.requiredTime !== 'string' || body.requiredTime.trim().length === 0) {
      return { error: 'requiredTime must be a valid future date.' };
    }
    const requiredTime = new Date(body.requiredTime);
    if (Number.isNaN(requiredTime.getTime()) || requiredTime.getTime() <= Date.now()) {
      return { error: 'requiredTime must be a valid future date.' };
    }
    values.requiredTime = requiredTime;
  }

  if (provided('instructions')) {
    if (typeof body.instructions !== 'string') {
      return { error: 'instructions must be a string.' };
    }
    values.instructions = body.instructions.trim();
  }

  return { values };
}

function sendRequestValidationError(error, res) {
  if (error.name === 'ValidationError' || error.name === 'CastError') {
    return res.status(400).json({ message: 'Request data is invalid.' });
  }
  return null;
}

export async function createRequest(req, res, next) {
  const validation = validateRequestInput(req.body);
  if (validation.error) {
    return res.status(400).json({ message: validation.error });
  }

  try {
    const createdAt = new Date();
    const request = await Request.create({
      ...validation.values,
      requester: req.user._id,
      statusHistory: [{ status: 'OPEN', changedBy: req.user._id, changedAt: createdAt }],
    });
    const populatedRequest = await populateRequestDetails(Request.findById(request._id));
    return res.status(201).json({ request: populatedRequest });
  } catch (error) {
    return sendRequestValidationError(error, res) || next(error);
  }
}

export async function getOpenRequests(req, res, next) {
  const pagination = parsePagination(req.query);
  if (!pagination) {
    return res.status(400).json({ message: 'page and limit must be positive integers; limit cannot exceed 100.' });
  }

  const filter = { status: 'OPEN' };
  if (req.query.category !== undefined) {
    if (typeof req.query.category !== 'string' || req.query.category.trim().length === 0) {
      return res.status(400).json({ message: 'category must be a valid category.' });
    }
    const category = req.query.category.trim().toUpperCase();
    if (!REQUEST_CATEGORIES.includes(category)) {
      return res.status(400).json({ message: 'category must be a valid category.' });
    }
    filter.category = category;
  }

  if (req.query.location !== undefined) {
    if (typeof req.query.location !== 'string' || req.query.location.trim().length === 0) {
      return res.status(400).json({ message: 'location must be a non-empty string.' });
    }
    filter.location = { $regex: escapeRegex(req.query.location.trim()), $options: 'i' };
  }

  try {
    const [requests, total] = await Promise.all([
      Request.find(filter)
        .populate({ path: 'requester', select: REQUESTER_FIELDS })
        .sort({ requiredTime: 1, createdAt: -1 })
        .skip(pagination.skip)
        .limit(pagination.limit),
      Request.countDocuments(filter),
    ]);

    return res.status(200).json({
      requests,
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

export async function getRequestById(req, res, next) {
  if (!validRequestId(req.params.id)) {
    return res.status(400).json({ message: 'Request ID is invalid.' });
  }

  try {
    const request = await populateRequestDetails(Request.findById(req.params.id));
    if (!request) {
      return res.status(404).json({ message: 'Request not found.' });
    }
    return res.status(200).json({ request });
  } catch (error) {
    return next(error);
  }
}

export async function getMyRequests(req, res, next) {
  const pagination = parsePagination(req.query);
  if (!pagination) {
    return res.status(400).json({ message: 'page and limit must be positive integers; limit cannot exceed 100.' });
  }

  const filter = { requester: req.user._id };
  try {
    const [requests, total] = await Promise.all([
      Request.find(filter)
        .populate({ path: 'requester', select: REQUESTER_FIELDS })
        .sort({ createdAt: -1 })
        .skip(pagination.skip)
        .limit(pagination.limit),
      Request.countDocuments(filter),
    ]);

    return res.status(200).json({
      requests,
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

export async function updateRequest(req, res, next) {
  if (!validRequestId(req.params.id)) {
    return res.status(400).json({ message: 'Request ID is invalid.' });
  }

  const validation = validateRequestInput(req.body, { partial: true });
  if (validation.error) {
    return res.status(400).json({ message: validation.error });
  }

  try {
    const existingRequest = await Request.findById(req.params.id);
    if (!existingRequest) {
      return res.status(404).json({ message: 'Request not found.' });
    }
    if (!existingRequest.requester.equals(req.user._id)) {
      return res.status(403).json({ message: 'You can only update your own requests.' });
    }
    if (!EDITABLE_STATUSES.includes(existingRequest.status)) {
      return res.status(409).json({ message: 'This request can no longer be edited.' });
    }

    const request = await Request.findOneAndUpdate(
      {
        _id: req.params.id,
        requester: req.user._id,
        status: { $in: EDITABLE_STATUSES },
      },
      { $set: validation.values },
      { new: true, runValidators: true },
    ).populate({ path: 'requester', select: REQUESTER_FIELDS });

    if (!request) {
      return res.status(409).json({ message: 'This request can no longer be edited.' });
    }
    return res.status(200).json({ request });
  } catch (error) {
    return sendRequestValidationError(error, res) || next(error);
  }
}

export async function cancelRequest(req, res, next) {
  if (!validRequestId(req.params.id)) {
    return res.status(400).json({ message: 'Request ID is invalid.' });
  }

  let session;
  try {
    session = await mongoose.startSession();
    await session.withTransaction(async () => {
      const request = await Request.findById(req.params.id).session(session);
      if (!request) {
        const error = new Error('Request not found.');
        error.statusCode = 404;
        throw error;
      }
      if (!request.requester.equals(req.user._id)) {
        const error = new Error('You can only cancel your own requests.');
        error.statusCode = 403;
        throw error;
      }

      const involvedOffers = await Offer.find({
        request: request._id,
        status: { $in: ['PENDING', 'COUNTERED'] },
      }).select('helper').session(session);

      await transitionRequestStatus(request, 'CANCELLED', {
        changedBy: req.user._id,
        session,
      });
      await Offer.updateMany(
        { request: request._id, status: { $in: ['PENDING', 'COUNTERED'] } },
        { $set: { status: 'REJECTED' } },
        { session },
      );

      const notifiedHelpers = new Set([req.user._id.toString()]);
      for (const offer of involvedOffers) {
        const helperId = offer.helper.toString();
        if (notifiedHelpers.has(helperId)) continue;
        notifiedHelpers.add(helperId);
        await createNotification({
          userId: offer.helper,
          message: 'A request you offered to help with was cancelled.',
          type: NOTIFICATION_TYPES.REQUEST_CANCELLED,
          session,
        });
      }
    });

    const request = await populateRequestDetails(Request.findById(req.params.id));
    return res.status(200).json({ request });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ message: error.message });
    }
    return sendRequestValidationError(error, res) || next(error);
  } finally {
    if (session) await session.endSession();
  }
}
