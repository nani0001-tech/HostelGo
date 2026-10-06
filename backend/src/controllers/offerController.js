import mongoose from 'mongoose';
import Offer from '../models/Offer.js';
import Request from '../models/Request.js';
import { createNotification, NOTIFICATION_TYPES } from '../services/notificationService.js';
import {
  canTransitionRequestStatus,
  prepareRequestForNegotiation,
  transitionRequestStatus,
} from '../services/requestStatus.js';

const SAFE_USER_FIELDS = 'name rating ratingCount';
const ACTIVE_REQUEST_STATUSES = ['OPEN', 'NEGOTIATING'];

function httpError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function sameId(left, right) {
  return left?.toString() === right?.toString();
}

function validObjectId(id) {
  return mongoose.isObjectIdOrHexString(id);
}

function getOfferInput(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { error: 'Request body must be a JSON object.' };
  }

  const unsupportedField = Object.keys(body).find((key) => !['proposedPrice', 'message'].includes(key));
  if (unsupportedField) {
    return { error: `Unsupported offer field: ${unsupportedField}.` };
  }
  if (typeof body.proposedPrice !== 'number'
    || !Number.isFinite(body.proposedPrice)
    || body.proposedPrice < 0) {
    return { error: 'proposedPrice must be a non-negative number.' };
  }
  if (body.message !== undefined && typeof body.message !== 'string') {
    return { error: 'message must be a string.' };
  }

  return {
    values: {
      proposedPrice: body.proposedPrice,
      ...(body.message === undefined ? {} : { message: body.message.trim() }),
    },
  };
}

function safeUser(user) {
  if (!user) return null;
  return {
    id: user._id.toString(),
    name: user.name,
    rating: user.rating,
    ratingCount: user.ratingCount,
  };
}

function safeRequest(request, { includeRequester = false } = {}) {
  if (!request) return null;
  const result = {
    id: request._id.toString(),
    item: request.item,
    category: request.category,
    reward: request.reward,
    location: request.location,
    status: request.status,
  };
  if (request.acceptedPrice !== undefined && request.acceptedPrice !== null) {
    result.acceptedPrice = request.acceptedPrice;
  }
  if (request.acceptedOffer !== undefined && request.acceptedOffer !== null) {
    result.acceptedOfferId = request.acceptedOffer.toString();
  }
  if (includeRequester) result.requester = safeUser(request.requester);
  return result;
}

function offerView(offer, requesterId) {
  const helper = offer.helper;
  const author = offer.createdBy || helper;
  return {
    id: offer._id.toString(),
    requestId: offer.request?._id?.toString() || offer.request?.toString(),
    helper: safeUser(helper),
    createdBy: safeUser(author),
    createdByRole: sameId(author?._id, requesterId) ? 'REQUESTER' : 'HELPER',
    previousOfferId: offer.previousOffer?.toString() || null,
    proposedPrice: offer.proposedPrice,
    message: offer.message,
    status: offer.status,
    createdAt: offer.createdAt,
  };
}

function sendOfferError(error, res, next) {
  if (error.statusCode) {
    return res.status(error.statusCode).json({ message: error.message });
  }
  if (error.code === 11000) {
    return res.status(409).json({ message: 'This offer has already been answered.' });
  }
  if (error.name === 'ValidationError' || error.name === 'CastError') {
    return res.status(400).json({ message: 'Offer data is invalid.' });
  }
  return next(error);
}

async function loadPopulatedOffer(offerId) {
  return Offer.findById(offerId)
    .populate({ path: 'helper', select: SAFE_USER_FIELDS })
    .populate({ path: 'createdBy', select: SAFE_USER_FIELDS })
    .populate({
      path: 'request',
      select: 'item category reward location status acceptedOffer acceptedPrice requester',
      populate: { path: 'requester', select: SAFE_USER_FIELDS },
    });
}

export async function createOffer(req, res, next) {
  if (!validObjectId(req.params.requestId)) {
    return res.status(400).json({ message: 'Request ID is invalid.' });
  }
  const input = getOfferInput(req.body);
  if (input.error) {
    return res.status(400).json({ message: input.error });
  }

  let session;
  let offerId;
  try {
    session = await mongoose.startSession();
    await session.withTransaction(async () => {
      const request = await Request.findById(req.params.requestId).session(session);
      if (!request) throw httpError(404, 'Request not found.');
      if (sameId(request.requester, req.user._id)) {
        throw httpError(403, 'You cannot make an offer on your own request.');
      }
      if (!ACTIVE_REQUEST_STATUSES.includes(request.status)) {
        throw httpError(409, 'Offers can only be made on open requests.');
      }

      const [offer] = await Offer.create([{
        request: request._id,
        helper: req.user._id,
        createdBy: req.user._id,
        ...input.values,
      }], { session });

      await prepareRequestForNegotiation(request, req.user._id, session);
      await createNotification({
        userId: request.requester,
        message: 'New offer received for your request.',
        type: NOTIFICATION_TYPES.OFFER_RECEIVED,
        session,
      });
      offerId = offer._id;
    });

    const offer = await loadPopulatedOffer(offerId);
    return res.status(201).json({
      offer: offerView(offer, offer.request?.requester?._id),
      request: safeRequest(offer.request, { includeRequester: true }),
    });
  } catch (error) {
    return sendOfferError(error, res, next);
  } finally {
    if (session) await session.endSession();
  }
}

export async function listRequestOffers(req, res, next) {
  if (!validObjectId(req.params.requestId)) {
    return res.status(400).json({ message: 'Request ID is invalid.' });
  }

  try {
    const request = await Request.findById(req.params.requestId);
    if (!request) {
      return res.status(404).json({ message: 'Request not found.' });
    }
    const isRequester = sameId(request.requester, req.user._id);
    const helperHasOffer = isRequester ? false : await Offer.exists({ request: request._id, helper: req.user._id });
    if (!isRequester && !helperHasOffer) {
      return res.status(403).json({ message: 'Only the requester or a participant in this negotiation can view these offers.' });
    }

    const offers = await Offer.find(isRequester
      ? { request: request._id }
      : { request: request._id, helper: req.user._id })
      .populate({ path: 'helper', select: SAFE_USER_FIELDS })
      .populate({ path: 'createdBy', select: SAFE_USER_FIELDS })
      .sort({ createdAt: 1, _id: 1 });

    return res.status(200).json({
      offers: offers.map((offer) => offerView(offer, request.requester)),
      request: safeRequest(request),
    });
  } catch (error) {
    return sendOfferError(error, res, next);
  }
}

export async function getMyOffers(req, res, next) {
  try {
    const offers = await Offer.find({
      $or: [
        { createdBy: req.user._id },
        { createdBy: { $exists: false }, helper: req.user._id },
      ],
    })
      .populate({ path: 'helper', select: SAFE_USER_FIELDS })
      .populate({ path: 'createdBy', select: SAFE_USER_FIELDS })
      .populate({
        path: 'request',
        select: 'item category reward location status acceptedOffer acceptedPrice requester',
        populate: { path: 'requester', select: SAFE_USER_FIELDS },
      })
      .sort({ createdAt: -1, _id: -1 });

    return res.status(200).json({
      offers: offers.map((offer) => ({
        ...offerView(offer, offer.request?.requester?._id),
        request: safeRequest(offer.request),
      })),
    });
  } catch (error) {
    return sendOfferError(error, res, next);
  }
}

export async function acceptOffer(req, res, next) {
  if (!validObjectId(req.params.offerId)) {
    return res.status(400).json({ message: 'Offer ID is invalid.' });
  }

  let session;
  let wasAlreadyAccepted = false;
  try {
    session = await mongoose.startSession();
    await session.withTransaction(async () => {
      const offer = await Offer.findById(req.params.offerId).session(session);
      if (!offer) throw httpError(404, 'Offer not found.');

      const request = await Request.findById(offer.request).session(session);
      if (!request) throw httpError(404, 'Request not found.');

      const isRequester = sameId(request.requester, req.user._id);
      const isHelperCounter = !isRequester
        && sameId(offer.helper, req.user._id)
        && sameId(offer.createdBy, request.requester)
        && Boolean(offer.previousOffer);
      let previousOffer = null;

      if (isHelperCounter) {
        previousOffer = await Offer.findById(offer.previousOffer).session(session);
        const previousWasMadeByHelper = previousOffer
          && sameId(previousOffer.createdBy || previousOffer.helper, req.user._id);
        if (!previousOffer
          || !sameId(previousOffer.request, request._id)
          || !sameId(previousOffer.helper, req.user._id)
          || !previousWasMadeByHelper) {
          throw httpError(403, 'This counter offer is not part of your negotiation.');
        }
      }

      if (!isRequester && !isHelperCounter) {
        throw httpError(403, 'Only the requester or the offer helper can accept this offer.');
      }

      if (request.status === 'ACCEPTED'
        && offer.status === 'ACCEPTED'
        && sameId(request.acceptedOffer, offer._id)) {
        wasAlreadyAccepted = true;
        return;
      }

      if (!canTransitionRequestStatus(request.status, 'ACCEPTED')) {
        throw httpError(409, 'This request cannot accept an offer in its current status.');
      }
      if (offer.status !== 'PENDING') {
        throw httpError(409, 'Only a pending offer can be accepted.');
      }
      if (isHelperCounter && previousOffer.status !== 'COUNTERED') {
        throw httpError(409, 'This counter offer is no longer part of an active negotiation.');
      }

      // Preserve the accepted offer's full ancestry as negotiation history. Other pending
      // or countered offers remain competitors and are rejected below.
      const acceptedChainIds = new Set([offer._id.toString()]);
      let ancestorId = offer.previousOffer;
      for (let depth = 0; ancestorId && depth < 100; depth += 1) {
        const ancestorKey = ancestorId.toString();
        if (acceptedChainIds.has(ancestorKey)) break;
        const ancestor = await Offer.findOne({ _id: ancestorId, request: request._id })
          .select('_id previousOffer')
          .session(session);
        if (!ancestor) break;
        acceptedChainIds.add(ancestorKey);
        ancestorId = ancestor.previousOffer;
      }
      const acceptedChain = [...acceptedChainIds].map((id) => new mongoose.Types.ObjectId(id));

      await transitionRequestStatus(request, 'ACCEPTED', {
        changedBy: req.user._id,
        session,
        extraSet: {
          acceptedOffer: offer._id,
          acceptedPrice: offer.proposedPrice,
        },
      });

      const acceptedUpdate = await Offer.updateOne(
        { _id: offer._id, status: 'PENDING' },
        { $set: { status: 'ACCEPTED' } },
        { session },
      );
      if (acceptedUpdate.modifiedCount !== 1) {
        throw httpError(409, 'This offer is no longer pending.');
      }

      const competingOffers = await Offer.find({
        request: request._id,
        _id: { $nin: acceptedChain },
        status: { $in: ['PENDING', 'COUNTERED'] },
      }).select('helper').session(session);
      await Offer.updateMany(
        {
          request: request._id,
          _id: { $nin: acceptedChain },
          status: { $in: ['PENDING', 'COUNTERED'] },
        },
        { $set: { status: 'REJECTED' } },
        { session },
      );

      if (!sameId(offer.helper, req.user._id)) {
        await createNotification({
          userId: offer.helper,
          message: 'Your offer was accepted.',
          type: NOTIFICATION_TYPES.OFFER_ACCEPTED,
          session,
        });
      }

      const notifiedHelpers = new Set([offer.helper.toString(), req.user._id.toString()]);
      for (const competingOffer of competingOffers) {
        const helperId = competingOffer.helper.toString();
        if (notifiedHelpers.has(helperId)) continue;
        notifiedHelpers.add(helperId);
        await createNotification({
          userId: competingOffer.helper,
          message: 'Your offer was not selected.',
          type: NOTIFICATION_TYPES.OFFER_REJECTED,
          session,
        });
      }
    });

    const acceptedOffer = await loadPopulatedOffer(req.params.offerId);
    return res.status(200).json({
      offer: offerView(acceptedOffer, acceptedOffer.request?.requester?._id),
      request: safeRequest(acceptedOffer.request, { includeRequester: true }),
      idempotent: wasAlreadyAccepted,
    });
  } catch (error) {
    return sendOfferError(error, res, next);
  } finally {
    if (session) await session.endSession();
  }
}

export async function rejectOffer(req, res, next) {
  if (!validObjectId(req.params.offerId)) {
    return res.status(400).json({ message: 'Offer ID is invalid.' });
  }

  let session;
  let offerId;
  try {
    session = await mongoose.startSession();
    await session.withTransaction(async () => {
      const offer = await Offer.findById(req.params.offerId).session(session);
      if (!offer) throw httpError(404, 'Offer not found.');
      const request = await Request.findById(offer.request).session(session);
      if (!request) throw httpError(404, 'Request not found.');
      if (!sameId(request.requester, req.user._id)) {
        throw httpError(403, 'Only the request owner can reject an offer.');
      }
      if (!ACTIVE_REQUEST_STATUSES.includes(request.status) || offer.status !== 'PENDING') {
        throw httpError(409, 'This offer cannot be rejected in its current status.');
      }

      const result = await Offer.updateOne(
        { _id: offer._id, status: 'PENDING' },
        { $set: { status: 'REJECTED' } },
        { session },
      );
      if (result.modifiedCount !== 1) throw httpError(409, 'This offer is no longer pending.');
      if (!sameId(offer.helper, req.user._id)) {
        await createNotification({
          userId: offer.helper,
          message: 'Your offer was not selected.',
          type: NOTIFICATION_TYPES.OFFER_REJECTED,
          session,
        });
      }
      offerId = offer._id;
    });

    const rejectedOffer = await loadPopulatedOffer(offerId);
    return res.status(200).json({
      offer: offerView(rejectedOffer, rejectedOffer.request?.requester?._id),
    });
  } catch (error) {
    return sendOfferError(error, res, next);
  } finally {
    if (session) await session.endSession();
  }
}

export async function counterOffer(req, res, next) {
  if (!validObjectId(req.params.offerId)) {
    return res.status(400).json({ message: 'Offer ID is invalid.' });
  }
  const input = getOfferInput(req.body);
  if (input.error) {
    return res.status(400).json({ message: input.error });
  }

  let session;
  let counterOfferId;
  try {
    session = await mongoose.startSession();
    await session.withTransaction(async () => {
      const previousOffer = await Offer.findById(req.params.offerId).session(session);
      if (!previousOffer) throw httpError(404, 'Offer not found.');
      const request = await Request.findById(previousOffer.request).session(session);
      if (!request) throw httpError(404, 'Request not found.');
      if (!ACTIVE_REQUEST_STATUSES.includes(request.status)) {
        throw httpError(409, 'This request is no longer open to negotiation.');
      }
      if (previousOffer.status !== 'PENDING') {
        throw httpError(409, 'Only the latest pending offer can be countered.');
      }

      const isRequester = sameId(request.requester, req.user._id);
      const isOfferHelper = sameId(previousOffer.helper, req.user._id);
      const previousAuthor = previousOffer.createdBy || previousOffer.helper;
      if (!isRequester && !isOfferHelper) {
        throw httpError(403, 'Only the request owner or offer helper can negotiate.');
      }
      if (sameId(previousAuthor, req.user._id)) {
        throw httpError(409, 'The other participant must respond next.');
      }

      const previousUpdate = await Offer.updateOne(
        { _id: previousOffer._id, status: 'PENDING' },
        { $set: { status: 'COUNTERED' } },
        { session },
      );
      if (previousUpdate.modifiedCount !== 1) {
        throw httpError(409, 'This offer has already been answered.');
      }

      const [createdCounter] = await Offer.create([{
        request: request._id,
        helper: previousOffer.helper,
        createdBy: req.user._id,
        previousOffer: previousOffer._id,
        ...input.values,
      }], { session });

      await prepareRequestForNegotiation(request, req.user._id, session);
      const recipientId = sameId(req.user._id, request.requester)
        ? previousOffer.helper
        : request.requester;
      if (!sameId(recipientId, req.user._id)) {
        await createNotification({
          userId: recipientId,
          message: 'New counter offer received.',
          type: NOTIFICATION_TYPES.COUNTER_OFFER,
          session,
        });
      }
      counterOfferId = createdCounter._id;
    });

    const offer = await loadPopulatedOffer(counterOfferId);
    return res.status(201).json({
      offer: offerView(offer, offer.request?.requester?._id),
      request: safeRequest(offer.request, { includeRequester: true }),
    });
  } catch (error) {
    return sendOfferError(error, res, next);
  } finally {
    if (session) await session.endSession();
  }
}
