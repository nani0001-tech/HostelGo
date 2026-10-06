import 'dotenv/config';
import mongoose from 'mongoose';
import User from '../src/models/User.js';
import Request from '../src/models/Request.js';
import Offer from '../src/models/Offer.js';
import Notification from '../src/models/Notification.js';

const API_URL = `http://127.0.0.1:${process.env.PORT || 5000}/api`;
const suffix = `${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;
const createdUserIds = [];
const createdRequestIds = [];
const passed = [];

async function request(path, { token, method = 'GET', body, expectedStatus } = {}) {
  let response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      method,
      headers: {
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  } catch {
    throw new Error('HostelGo API is unavailable. Start the backend before running this smoke test.');
  }
  const payload = await response.json().catch(() => ({}));
  if (expectedStatus !== undefined && response.status !== expectedStatus) {
    throw new Error(`${method} ${path} returned ${response.status}; expected ${expectedStatus}.`);
  }
  return { status: response.status, payload };
}

function assert(condition, description) {
  if (!condition) throw new Error(`Failed: ${description}`);
  passed.push(description);
}

async function createUser(role, number) {
  const email = `offer-smoke-${role}-${suffix}-${number}@example.invalid`;
  const phone = `96${String(Date.now()).slice(-8)}`;
  const registration = await request('/auth/register', {
    method: 'POST',
    expectedStatus: 201,
    body: { name: `Offer smoke ${role}`, email, password: 'Temporary-Offer-Password-91!', phone, hostel: 'Temporary offer smoke hostel' },
  });
  const id = registration.payload.user.id || registration.payload.user._id;
  if (id) createdUserIds.push(id);
  const login = await request('/auth/login', {
    method: 'POST',
    expectedStatus: 200,
    body: { email, password: 'Temporary-Offer-Password-91!' },
  });
  return { id, token: login.payload.token };
}

async function createRequest(token, item) {
  const response = await request('/requests', {
    token,
    method: 'POST',
    expectedStatus: 201,
    body: {
      item,
      category: 'GROCERIES',
      quantity: 2,
      reward: 50,
      location: 'Temporary offer smoke location',
      requiredTime: new Date(Date.now() + 3_600_000).toISOString(),
      instructions: 'Temporary offer workflow verification.',
    },
  });
  const id = response.payload.request._id || response.payload.request.id;
  createdRequestIds.push(id);
  return id;
}

async function main() {
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is not configured.');
  const requester = await createUser('requester', 1);
  const helper = await createUser('helper', 2);
  const otherHelper = await createUser('other-helper', 3);
  const unrelated = await createUser('unrelated', 4);

  const primaryRequest = await createRequest(requester.token, 'Temporary negotiation request');
  let result = await request(`/requests/${primaryRequest}/offers`, { token: helper.token, expectedStatus: 403 });
  assert(result.status === 403, 'helper without a negotiation cannot list request offers');

  const firstOfferResponse = await request(`/requests/${primaryRequest}/offers`, {
    token: helper.token,
    method: 'POST',
    expectedStatus: 201,
    body: { proposedPrice: 35, message: 'I can bring this.' },
  });
  const firstOfferId = firstOfferResponse.payload.offer.id;
  result = await request(`/offers/${firstOfferId}/accept`, { token: helper.token, method: 'PUT', expectedStatus: 403 });
  assert(result.status === 403, 'helper cannot accept their original offer');

  const competingResponse = await request(`/requests/${primaryRequest}/offers`, {
    token: otherHelper.token,
    method: 'POST',
    expectedStatus: 201,
    body: { proposedPrice: 32, message: 'I can go as well.' },
  });
  const competingOfferId = competingResponse.payload.offer.id;

  result = await request(`/requests/${primaryRequest}/offers`, { token: requester.token, expectedStatus: 200 });
  assert(result.payload.offers.length === 2, 'requester still sees all offers on their request');
  result = await request(`/requests/${primaryRequest}/offers`, { token: helper.token, expectedStatus: 200 });
  assert(result.payload.offers.length === 1 && result.payload.offers[0].id === firstOfferId, 'helper only sees their own offer chain before counter');
  assert(!JSON.stringify(result.payload).includes('email') && !JSON.stringify(result.payload).includes('password'), 'offer listing omits private account fields');
  result = await request(`/requests/${primaryRequest}/offers`, { token: unrelated.token, expectedStatus: 403 });
  assert(result.status === 403, 'unrelated user cannot list another negotiation');

  const counterResponse = await request(`/offers/${firstOfferId}/counter`, {
    token: requester.token,
    method: 'POST',
    expectedStatus: 201,
    body: { proposedPrice: 40, message: 'I can do 40.' },
  });
  const counterId = counterResponse.payload.offer.id;
  assert(counterResponse.payload.offer.previousOfferId === firstOfferId, 'requester counter is linked to original offer');
  result = await request(`/requests/${primaryRequest}/offers`, { token: helper.token, expectedStatus: 200 });
  assert(result.payload.offers.length === 2 && result.payload.offers.some((offer) => offer.id === counterId), 'helper can retrieve requester counter in their chain');
  assert(!result.payload.offers.some((offer) => offer.id === competingOfferId), 'helper cannot see another helper offer');

  result = await request(`/offers/${counterId}/accept`, { token: otherHelper.token, method: 'PUT', expectedStatus: 403 });
  assert(result.status === 403, 'another helper cannot accept this counter');
  result = await request(`/offers/${counterId}/accept`, { token: unrelated.token, method: 'PUT', expectedStatus: 403 });
  assert(result.status === 403, 'unrelated user cannot accept this counter');
  result = await request(`/offers/${counterId}/accept`, { token: helper.token, method: 'PUT', expectedStatus: 200 });
  assert(result.payload.request.status === 'ACCEPTED' && result.payload.request.acceptedPrice === 40, 'helper acceptance sets accepted request and final price');
  assert(result.payload.request.acceptedOfferId === counterId && result.payload.offer.id === counterId, 'accepted offer reference points to the requester counter');
  result = await request(`/requests/${primaryRequest}/offers`, { token: requester.token, expectedStatus: 200 });
  assert(result.payload.offers.find((offer) => offer.id === firstOfferId)?.status === 'COUNTERED', 'accepted chain keeps the original offer as countered history');
  assert(result.payload.offers.find((offer) => offer.id === competingOfferId)?.status === 'REJECTED', 'acceptance rejects competing offer');
  result = await request(`/offers/${counterId}/accept`, { token: helper.token, method: 'PUT', expectedStatus: 200 });
  assert(result.payload.idempotent === true, 'repeated acceptance of the same counter is idempotent');
  result = await request(`/offers/${firstOfferId}/counter`, { token: requester.token, method: 'POST', expectedStatus: 409, body: { proposedPrice: 41 } });
  assert(result.status === 409, 'counter is rejected after request acceptance');

  const requesterAcceptRequest = await createRequest(requester.token, 'Temporary requester acceptance request');
  const requesterAcceptOffer = await request(`/requests/${requesterAcceptRequest}/offers`, {
    token: helper.token,
    method: 'POST',
    expectedStatus: 201,
    body: { proposedPrice: 28 },
  });
  result = await request(`/offers/${requesterAcceptOffer.payload.offer.id}/accept`, { token: requester.token, method: 'PUT', expectedStatus: 200 });
  assert(result.payload.request.acceptedPrice === 28, 'requester can still accept a helper original offer');

  const rejectedRequest = await createRequest(requester.token, 'Temporary rejected offer request');
  const rejectedOffer = await request(`/requests/${rejectedRequest}/offers`, {
    token: helper.token,
    method: 'POST',
    expectedStatus: 201,
    body: { proposedPrice: 17 },
  });
  result = await request(`/offers/${rejectedOffer.payload.offer.id}/reject`, { token: requester.token, method: 'PUT', expectedStatus: 200 });
  assert(result.payload.offer.status === 'REJECTED', 'requester can still reject a helper offer');
  result = await request(`/offers/${rejectedOffer.payload.offer.id}/accept`, { token: requester.token, method: 'PUT', expectedStatus: 409 });
  assert(result.status === 409, 'rejected offer cannot later be accepted');

  const unrelatedRequest = await createRequest(requester.token, 'Temporary unrelated request');
  const otherHelperOffer = await request(`/requests/${unrelatedRequest}/offers`, {
    token: otherHelper.token,
    method: 'POST',
    expectedStatus: 201,
    body: { proposedPrice: 25 },
  });
  const otherHelperCounter = await request(`/offers/${otherHelperOffer.payload.offer.id}/counter`, {
    token: requester.token,
    method: 'POST',
    expectedStatus: 201,
    body: { proposedPrice: 23 },
  });
  result = await request(`/offers/${otherHelperCounter.payload.offer.id}/accept`, { token: helper.token, method: 'PUT', expectedStatus: 403 });
  assert(result.status === 403, 'helper cannot accept another helper counter on another request');

  const cancelledRequest = await createRequest(requester.token, 'Temporary cancelled request');
  const cancelledOffer = await request(`/requests/${cancelledRequest}/offers`, {
    token: helper.token,
    method: 'POST',
    expectedStatus: 201,
    body: { proposedPrice: 21 },
  });
  await request(`/requests/${cancelledRequest}/cancel`, { token: requester.token, method: 'PUT', expectedStatus: 200 });
  result = await request(`/offers/${cancelledOffer.payload.offer.id}/counter`, { token: requester.token, method: 'POST', expectedStatus: 409, body: { proposedPrice: 20 } });
  assert(result.status === 409, 'counter is rejected after request cancellation');
  result = await request(`/offers/${cancelledOffer.payload.offer.id}/accept`, { token: requester.token, method: 'PUT', expectedStatus: 409 });
  assert(result.status === 409, 'acceptance is rejected after request cancellation');

  const completedRequest = await createRequest(requester.token, 'Temporary completed request');
  const completedOffer = await request(`/requests/${completedRequest}/offers`, {
    token: helper.token,
    method: 'POST',
    expectedStatus: 201,
    body: { proposedPrice: 19 },
  });
  await request(`/offers/${completedOffer.payload.offer.id}/accept`, { token: requester.token, method: 'PUT', expectedStatus: 200 });
  await request(`/requests/${completedRequest}/start`, { token: helper.token, method: 'PUT', expectedStatus: 200 });
  await request(`/requests/${completedRequest}/complete`, { token: requester.token, method: 'PUT', expectedStatus: 200 });
  result = await request(`/offers/${completedOffer.payload.offer.id}/accept`, { token: requester.token, method: 'PUT', expectedStatus: 409 });
  assert(result.status === 409, 'acceptance is rejected after request completion');

  console.log(`PASS ${passed.length} offer negotiation security checks.`);
  for (const description of passed) console.log(`PASS ${description}`);
}

try {
  await main();
} finally {
  if (!process.env.MONGODB_URI) process.exitCode = 1;
  else {
    await mongoose.connect(process.env.MONGODB_URI);
    const userIds = createdUserIds.map((id) => new mongoose.Types.ObjectId(id));
    const requestIds = createdRequestIds.map((id) => new mongoose.Types.ObjectId(id));
    if (userIds.length || requestIds.length) {
      await Notification.deleteMany({ user: { $in: userIds } });
      await Offer.deleteMany({ $or: [{ request: { $in: requestIds } }, { helper: { $in: userIds } }, { createdBy: { $in: userIds } }] });
      await Request.deleteMany({ _id: { $in: requestIds } });
      await User.deleteMany({ _id: { $in: userIds } });
    }
    await mongoose.disconnect();
  }
}
