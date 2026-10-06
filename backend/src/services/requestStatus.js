import Request from '../models/Request.js';

export const REQUEST_STATUS_TRANSITIONS = Object.freeze({
  OPEN: Object.freeze(['NEGOTIATING', 'CANCELLED']),
  NEGOTIATING: Object.freeze(['ACCEPTED', 'CANCELLED']),
  ACCEPTED: Object.freeze(['IN_PROGRESS']),
  IN_PROGRESS: Object.freeze(['COMPLETED']),
  COMPLETED: Object.freeze([]),
  CANCELLED: Object.freeze([]),
});

export function canTransitionRequestStatus(fromStatus, toStatus) {
  return REQUEST_STATUS_TRANSITIONS[fromStatus]?.includes(toStatus) ?? false;
}

export class RequestStatusTransitionError extends Error {
  constructor(message = 'Request status transition is no longer valid.') {
    super(message);
    this.name = 'RequestStatusTransitionError';
    this.statusCode = 409;
  }
}

export async function transitionRequestStatus(
  request,
  toStatus,
  { changedBy, session, extraSet = {}, changedAt = new Date() },
) {
  if (!canTransitionRequestStatus(request.status, toStatus)) {
    throw new RequestStatusTransitionError();
  }

  const result = await Request.updateOne(
    { _id: request._id, status: request.status },
    {
      $set: { ...extraSet, status: toStatus, updatedAt: changedAt },
      $push: {
        statusHistory: { status: toStatus, changedBy, changedAt },
      },
    },
    { ...(session ? { session } : {}), runValidators: true },
  );

  if (result.matchedCount !== 1) {
    throw new RequestStatusTransitionError();
  }
  return changedAt;
}

export async function prepareRequestForNegotiation(request, changedBy, session) {
  if (request.status === 'OPEN') {
    return transitionRequestStatus(request, 'NEGOTIATING', { changedBy, session });
  }
  if (request.status !== 'NEGOTIATING') {
    throw new RequestStatusTransitionError('This request is not accepting offers.');
  }

  // Touch the request inside the transaction to serialize a new offer against acceptance/cancellation.
  const result = await Request.updateOne(
    { _id: request._id, status: 'NEGOTIATING' },
    { $set: { updatedAt: new Date() } },
    { session },
  );
  if (result.matchedCount !== 1) {
    throw new RequestStatusTransitionError('This request is no longer accepting offers.');
  }
}
