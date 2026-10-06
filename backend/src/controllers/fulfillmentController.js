import mongoose from 'mongoose';
import Offer from '../models/Offer.js';
import Request from '../models/Request.js';
import {
  canTransitionRequestStatus,
  transitionRequestStatus,
} from '../services/requestStatus.js';
import { populateRequestDetails } from '../services/requestView.js';
import { createNotification, NOTIFICATION_TYPES } from '../services/notificationService.js';

function httpError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function sameId(left, right) {
  return left?.toString() === right?.toString();
}

function sendWorkflowError(error, res, next) {
  if (error.statusCode) {
    return res.status(error.statusCode).json({ message: error.message });
  }
  if (error.name === 'ValidationError' || error.name === 'CastError') {
    return res.status(400).json({ message: 'Request data is invalid.' });
  }
  return next(error);
}

export async function startFulfillment(req, res, next) {
  if (!mongoose.isObjectIdOrHexString(req.params.id)) {
    return res.status(400).json({ message: 'Request ID is invalid.' });
  }

  let session;
  let alreadyStarted = false;
  try {
    session = await mongoose.startSession();
    await session.withTransaction(async () => {
      const request = await Request.findById(req.params.id).session(session);
      if (!request) throw httpError(404, 'Request not found.');
      if (!request.acceptedOffer) {
        throw httpError(409, 'This request has no accepted offer.');
      }

      const acceptedOffer = await Offer.findById(request.acceptedOffer).session(session);
      if (!acceptedOffer
        || !sameId(acceptedOffer.request, request._id)
        || acceptedOffer.status !== 'ACCEPTED') {
        throw httpError(409, 'The accepted offer is unavailable.');
      }
      if (!sameId(acceptedOffer.helper, req.user._id)) {
        throw httpError(403, 'Only the accepted helper can start fulfillment.');
      }

      if (request.status === 'IN_PROGRESS') {
        alreadyStarted = true;
        return;
      }
      if (!canTransitionRequestStatus(request.status, 'IN_PROGRESS')) {
        throw httpError(409, 'This request cannot start fulfillment in its current status.');
      }

      await transitionRequestStatus(request, 'IN_PROGRESS', {
        changedBy: req.user._id,
        session,
      });
      await createNotification({
        userId: request.requester,
        message: 'Your request is now in progress.',
        type: NOTIFICATION_TYPES.FULFILLMENT_STARTED,
        session,
      });
    });

    const request = await populateRequestDetails(Request.findById(req.params.id));
    return res.status(200).json({ request, idempotent: alreadyStarted });
  } catch (error) {
    return sendWorkflowError(error, res, next);
  } finally {
    if (session) await session.endSession();
  }
}

export async function completeRequest(req, res, next) {
  if (!mongoose.isObjectIdOrHexString(req.params.id)) {
    return res.status(400).json({ message: 'Request ID is invalid.' });
  }

  let session;
  let alreadyCompleted = false;
  try {
    session = await mongoose.startSession();
    await session.withTransaction(async () => {
      const request = await Request.findById(req.params.id).session(session);
      if (!request) throw httpError(404, 'Request not found.');
      if (!sameId(request.requester, req.user._id)) {
        throw httpError(403, 'Only the requester can confirm completion.');
      }

      if (request.status === 'COMPLETED') {
        alreadyCompleted = true;
        return;
      }
      if (!canTransitionRequestStatus(request.status, 'COMPLETED')) {
        throw httpError(409, 'This request cannot be completed in its current status.');
      }

      const completedAt = new Date();
      await transitionRequestStatus(request, 'COMPLETED', {
        changedBy: req.user._id,
        session,
        changedAt: completedAt,
        extraSet: { completedAt },
      });

      if (request.acceptedOffer) {
        const acceptedOffer = await Offer.findById(request.acceptedOffer).select('request helper status').session(session);
        if (acceptedOffer && sameId(acceptedOffer.request, request._id) && acceptedOffer.status === 'ACCEPTED'
          && !sameId(acceptedOffer.helper, req.user._id)) {
          await createNotification({
            userId: acceptedOffer.helper,
            message: 'Your request has been marked completed.',
            type: NOTIFICATION_TYPES.REQUEST_COMPLETED,
            session,
          });
        }
      }
    });

    const request = await populateRequestDetails(Request.findById(req.params.id));
    return res.status(200).json({ request, idempotent: alreadyCompleted });
  } catch (error) {
    return sendWorkflowError(error, res, next);
  } finally {
    if (session) await session.endSession();
  }
}
