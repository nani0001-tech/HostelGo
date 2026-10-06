import { useCallback, useMemo, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import EmptyState from '../components/EmptyState.jsx';
import ErrorMessage from '../components/ErrorMessage.jsx';
import LoadingSpinner from '../components/LoadingSpinner.jsx';
import Modal from '../components/Modal.jsx';
import OfferForm, { friendlyOfferError } from '../components/OfferForm.jsx';
import ReviewForm from '../components/ReviewForm.jsx';
import StatusBadge from '../components/StatusBadge.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import useResource from '../hooks/useResource.js';
import { offerApi, requestApi, reviewApi } from '../services/api.js';
import { formatCurrency, formatDateTime } from '../utils/formatters.js';

const NEGOTIABLE_REQUEST_STATUSES = ['OPEN', 'NEGOTIATING'];
const STATUS_HISTORY_LABELS = {
  OPEN: 'Request created',
  NEGOTIATING: 'Negotiation started',
  ACCEPTED: 'Offer accepted',
  IN_PROGRESS: 'Fulfillment started',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
};

function getId(value) {
  if (!value) return '';
  return typeof value === 'object' ? String(value._id || value.id || '') : String(value);
}

function PersonAvatar({ person, label }) {
  if (person?.profileImage) return <img className="avatar detail-avatar" src={person.profileImage} alt={`${label} profile`} />;
  return <span className="avatar detail-avatar" aria-hidden="true">{person?.name?.trim()?.[0]?.toUpperCase() || 'S'}</span>;
}

function getOfferAuthor(offer, ownRequest) {
  if (ownRequest) return offer.createdByRole === 'REQUESTER' ? 'You' : offer.helper?.name || offer.createdBy?.name || 'Student';
  return 'You';
}

function getNegotiationDepth(offer, offersById, depth = 0, visited = new Set()) {
  if (!offer.previousOfferId || depth >= 12 || visited.has(offer.previousOfferId)) return depth;
  const previous = offersById.get(offer.previousOfferId);
  if (!previous) return depth;
  visited.add(offer.previousOfferId);
  return getNegotiationDepth(previous, offersById, depth + 1, visited);
}

function fulfillmentError(error, action) {
  if (error?.status === 401) return 'Your session has expired. Please log in again.';
  if (error?.status === 403) return action === 'start'
    ? 'Only the accepted helper can start this request.'
    : 'Only the requester can confirm completion.';
  if (error?.status === 404) return 'This request is no longer available.';
  if (error?.status === 409) return action === 'start'
    ? 'This request can no longer be started.'
    : 'This request can no longer be completed.';
  if (error?.status === 400) return 'Unable to update this request. Refresh and try again.';
  if (!error?.status) return 'Unable to connect to HostelGo. Check your connection and try again.';
  return 'Something went wrong. Please try again.';
}

function OfferHistory({ offers, ownRequest, requestActive, onAction }) {
  const offersById = useMemo(() => new Map(offers.map((offer) => [offer.id, offer])), [offers]);
  return (
    <div className="negotiation-list">
      {offers.map((offer) => {
        const author = getOfferAuthor(offer, ownRequest);
        const depth = getNegotiationDepth(offer, offersById);
        const canRespond = ownRequest && requestActive && offer.status === 'PENDING' && offer.createdByRole !== 'REQUESTER';
        return (
          <article className="negotiation-offer" key={offer.id} style={{ '--negotiation-depth': Math.min(depth, 4) }}>
            {depth > 0 && <span className="negotiation-connector" aria-hidden="true">↳</span>}
            <div className="negotiation-offer-heading">
              <div><strong>{author}</strong><time dateTime={offer.createdAt}>{formatDateTime(offer.createdAt)}</time></div>
              <strong className="negotiation-price">{formatCurrency(offer.proposedPrice)}</strong>
            </div>
            {offer.message && <p className="negotiation-message">{offer.message}</p>}
            <div className="negotiation-offer-footer">
              <StatusBadge status={offer.status} />
              {canRespond && <div className="offer-actions">
                <button className="button button-quiet button-small" type="button" onClick={() => onAction('accept', offer)}>Accept</button>
                <button className="button button-quiet button-small" type="button" onClick={() => onAction('reject', offer)}>Reject</button>
                <button className="text-button" type="button" onClick={() => onAction('counter', offer)}>Counter</button>
              </div>}
              {ownRequest && requestActive && offer.status === 'PENDING' && offer.createdByRole === 'REQUESTER' && <span className="muted offer-waiting-note">Waiting for the helper to respond</span>}
            </div>
          </article>
        );
      })}
    </div>
  );
}

export default function RequestDetailPage() {
  const { id } = useParams();
  const location = useLocation();
  const { user } = useAuth();
  const [submittingOffer, setSubmittingOffer] = useState(false);
  const [processingAction, setProcessingAction] = useState(false);
  const [actionError, setActionError] = useState('');
  const [fulfillmentActionError, setFulfillmentActionError] = useState('');
  const [dialog, setDialog] = useState(null);
  const requestLoader = useCallback(() => requestApi.get(id), [id]);
  const { data, loading, error, reload: reloadRequest, setData: setRequestData } = useResource(requestLoader, [requestLoader]);
  const request = data?.request;
  const requestLoaded = Boolean(request);
  const userId = getId(user);
  const requesterId = getId(request?.requester);
  const ownRequest = Boolean(userId && requesterId && requesterId === userId);
  const offersLoader = useCallback(async () => {
    if (!requestLoaded || !user) return { offers: [], _requestScope: null };
    if (ownRequest) return { ...(await offerApi.forRequest(id)), _requestScope: id };
    const mine = await offerApi.mine();
    return { offers: (mine.offers || []).filter((offer) => offer.requestId === id), _requestScope: id };
  }, [id, ownRequest, requestLoaded, user]);
  const { data: offersData, loading: offersLoading, error: offersError, reload: reloadOffers } = useResource(offersLoader, [offersLoader]);
  const offers = offersData?.offers || [];
  const offersFetchedForRequest = offersData?._requestScope === id;
  const requestActive = NEGOTIABLE_REQUEST_STATUSES.includes(request?.status);
  const myOfferHistory = offers.filter((offer) => offer.createdByRole === 'HELPER');
  const hasActiveOffer = myOfferHistory.some((offer) => ['PENDING', 'COUNTERED'].includes(offer.status));
  const requesterName = request?.requester?.name || 'Hostel student';
  const acceptedHelper = request?.acceptedOffer?.helper;
  const acceptedHelperId = getId(acceptedHelper);
  const isAcceptedHelper = Boolean(userId && acceptedHelperId && userId === acceptedHelperId);
  const acceptedPrice = request?.acceptedPrice ?? request?.acceptedOffer?.proposedPrice;
  const reviewEligibilityLoader = useCallback(async () => {
    if (!requestLoaded || request?.status !== 'COMPLETED' || !userId) return { canReview: false, reason: 'NOT_COMPLETED', _requestScope: id };
    return { ...(await reviewApi.canReview(id)), _requestScope: id };
  }, [id, request?.status, requestLoaded, userId]);
  const { data: eligibilityData, loading: eligibilityLoading, error: eligibilityError, reload: reloadEligibility } = useResource(reviewEligibilityLoader, [reviewEligibilityLoader]);
  const eligibilityIsCurrent = eligibilityData?._requestScope === id;
  const [reviewSubmitted, setReviewSubmitted] = useState(false);
  const [reviewConflict, setReviewConflict] = useState(false);
  const canStartRequest = isAcceptedHelper && request?.status === 'ACCEPTED';
  const canConfirmCompletion = ownRequest && request?.status === 'IN_PROGRESS';
  const origin = location.state?.from;
  const backPath = origin?.pathname || (typeof origin === 'string' ? origin : '/requests');
  const backTo = origin?.pathname ? { pathname: origin.pathname, search: origin.search || '' } : backPath;
  const backLabel = backPath.startsWith('/my-requests') ? 'Back to My Requests' : ['/offers', '/my-offers'].includes(backPath) ? 'Back to My Offers' : 'Back to Requests';

  async function submitReview(values) {
    setReviewConflict(false);
    try {
      await reviewApi.create({ requestId: id, ...values });
      setReviewSubmitted(true);
      await reloadEligibility();
      try {
        const latestRequest = await requestApi.get(id);
        setRequestData(latestRequest);
      } catch {
        // The review has succeeded; keep its confirmation visible if refreshing details fails.
      }
    } catch (submitError) {
      if (submitError?.status === 409) {
        setReviewConflict(true);
        await reloadEligibility();
      }
      throw submitError;
    }
  }

  async function submitOffer(values) {
    setSubmittingOffer(true);
    setActionError('');
    try {
      await offerApi.create(id, values);
      await Promise.all([reloadRequest(), reloadOffers()]);
    } catch (submitError) {
      setActionError(friendlyOfferError(submitError));
    } finally {
      setSubmittingOffer(false);
    }
  }

  async function confirmAction() {
    if (!dialog || processingAction) return;
    setProcessingAction(true);
    setActionError('');
    try {
      if (dialog.type === 'startFulfillment' || dialog.type === 'completeFulfillment') {
        setFulfillmentActionError('');
        const response = dialog.type === 'startFulfillment'
          ? await requestApi.start(id)
          : await requestApi.complete(id);
        if (response?.request) setRequestData(response);
        else await reloadRequest();
        setDialog(null);
        return;
      }
      if (dialog.type === 'accept') await offerApi.accept(dialog.offer.id);
      if (dialog.type === 'reject') await offerApi.reject(dialog.offer.id);
      setDialog(null);
      await Promise.all([reloadRequest(), reloadOffers()]);
    } catch (actionRequestError) {
      if (dialog.type === 'startFulfillment' || dialog.type === 'completeFulfillment') {
        setFulfillmentActionError(fulfillmentError(actionRequestError, dialog.type === 'startFulfillment' ? 'start' : 'complete'));
      } else {
        setActionError(friendlyOfferError(actionRequestError));
      }
    } finally {
      setProcessingAction(false);
    }
  }

  async function counterOffer(values) {
    if (!dialog || processingAction) return;
    setProcessingAction(true);
    setActionError('');
    try {
      await offerApi.counter(dialog.offer.id, values);
      setDialog(null);
      await Promise.all([reloadRequest(), reloadOffers()]);
    } catch (counterError) {
      setActionError(friendlyOfferError(counterError));
    } finally {
      setProcessingAction(false);
    }
  }

  if (loading) return <LoadingSpinner label="Loading request…" />;
  if (error) return <div className="page-content request-detail-page"><ErrorMessage message={error} onRetry={reloadRequest} /></div>;
  if (!request) return null;

  return (
    <section className="page-content request-detail-page" aria-labelledby="request-detail-title">
      {location.state?.requestCreated && <div className="request-created-banner" role="status"><span aria-hidden="true">✓</span> Your request was created successfully.</div>}
      <Link className="back-link" to={backTo}>← {backLabel}</Link>
      <div className="detail-layout offers-detail-layout">
        <article className="panel detail-card">
          <div className="request-card-top"><span className="category-pill">{request.category || 'Other'}</span><StatusBadge status={request.status} /></div>
          <h1 id="request-detail-title">{request.item || 'Request details'}</h1>
          <p className="detail-description">{request.instructions || 'No additional instructions were provided.'}</p>
          <dl className="detail-facts">
            <div><dt>Quantity</dt><dd>{request.quantity ?? 'Not specified'}</dd></div>
            <div><dt>Reward</dt><dd>{formatCurrency(request.reward)}</dd></div>
            <div><dt>Needed by</dt><dd>{formatDateTime(request.requiredTime)}</dd></div>
            <div><dt>Pickup or drop-off</dt><dd>{request.location || 'Not specified'}</dd></div>
            {request.createdAt && <div><dt>Posted</dt><dd>{formatDateTime(request.createdAt)}</dd></div>}
          </dl>
          <section className="detail-person-section" aria-labelledby="requester-heading">
            <h2 id="requester-heading">Requester</h2>
            <div className="detail-requester">
              <PersonAvatar person={request.requester} label="Requester" />
              <span>
                <strong>{ownRequest ? 'Your Request' : requesterName}</strong>
                {!ownRequest && request.requester?.hostel && <small className="detail-hostel">{request.requester.hostel}</small>}
                <small className="detail-rating">{request.requester?.ratingCount > 0 ? <><span aria-hidden="true">★</span> {Number(request.requester.rating || 0).toFixed(1)} · {request.requester.ratingCount} {request.requester.ratingCount === 1 ? 'review' : 'reviews'}</> : 'No reviews yet'}</small>
              </span>
            </div>
          </section>
          <section className="fulfillment-panel" aria-labelledby="fulfillment-heading">
            <div className="fulfillment-panel-heading"><div><span className="eyebrow">REQUEST LIFECYCLE</span><h2 id="fulfillment-heading">Request Status</h2></div><StatusBadge status={request.status} /></div>
            {request.status === 'ACCEPTED' && <p className="fulfillment-summary">{isAcceptedHelper ? 'You’ve been selected to fulfill this request.' : ownRequest ? 'Your request has an accepted helper.' : 'A helper has been selected for this request.'}</p>}
            {request.status === 'IN_PROGRESS' && <p className="fulfillment-summary">{ownRequest ? 'Your request is being fulfilled.' : isAcceptedHelper ? 'You’re currently fulfilling this request.' : 'This request is currently being fulfilled.'}</p>}
            {request.status === 'COMPLETED' && <p className="fulfillment-summary">Completed{request.completedAt ? ` on ${formatDateTime(request.completedAt)}` : '.'}</p>}
            {request.status === 'CANCELLED' && <p className="fulfillment-summary">This request was cancelled.</p>}
            {(acceptedHelper || acceptedPrice != null) && <div className="fulfillment-agreement">
              {acceptedHelper && <div className="detail-requester"><PersonAvatar person={acceptedHelper} label="Accepted helper" /><span><strong>{acceptedHelper.name || 'Hostel student'}</strong><small>Accepted helper</small><small className="detail-rating">{acceptedHelper.ratingCount > 0 ? <>★ {Number(acceptedHelper.rating || 0).toFixed(1)} · {acceptedHelper.ratingCount} {acceptedHelper.ratingCount === 1 ? 'review' : 'reviews'}</> : 'No reviews yet'}</small></span></div>}
              {acceptedPrice != null && <div className="accepted-price"><small>Agreed price</small><strong>{formatCurrency(acceptedPrice)}</strong></div>}
            </div>}
            {canStartRequest && <div className="fulfillment-action-block"><p className="muted">You’re responsible for fulfilling this request.</p><button className="button button-primary" type="button" onClick={() => { setFulfillmentActionError(''); setDialog({ type: 'startFulfillment' }); }}>Start Request</button></div>}
            {isAcceptedHelper && request.status === 'IN_PROGRESS' && <div className="fulfillment-action-block"><p className="muted">Waiting for requester confirmation.</p></div>}
            {canConfirmCompletion && <div className="fulfillment-action-block"><button className="button button-primary" type="button" onClick={() => { setFulfillmentActionError(''); setDialog({ type: 'completeFulfillment' }); }}>Confirm Completion</button></div>}
            {!dialog && fulfillmentActionError && <ErrorMessage message={fulfillmentActionError} />}
          </section>
          {Array.isArray(request.statusHistory) && request.statusHistory.length > 0 && <section className="request-timeline" aria-labelledby="request-timeline-heading">
            <h2 id="request-timeline-heading">Request Timeline</h2>
            <ol aria-label="Request status history">
              {request.statusHistory.map((entry, index) => <li key={`${entry.status}-${entry.changedAt || index}`}>
                <span className="timeline-marker" aria-hidden="true">✓</span>
                <div><strong>{STATUS_HISTORY_LABELS[entry.status] || entry.status.replaceAll('_', ' ')}</strong>{entry.changedAt && <time dateTime={entry.changedAt}>{formatDateTime(entry.changedAt)}</time>}</div>
              </li>)}
            </ol>
          </section>}
          {request.status === 'COMPLETED' && user && (reviewSubmitted || reviewConflict || eligibilityLoading || !eligibilityIsCurrent || eligibilityError || eligibilityData?.canReview || eligibilityData?.reason === 'ALREADY_REVIEWED') && <section className="review-request-panel" id="request-review" aria-labelledby="request-review-heading">
            <span className="eyebrow">COMMUNITY FEEDBACK</span>
            <h2 id="request-review-heading">Review this request</h2>
            {reviewSubmitted ? <p className="review-status-message" role="status">Your review was submitted. Thank you for sharing your experience.</p>
              : reviewConflict || (eligibilityIsCurrent && eligibilityData?.reason === 'ALREADY_REVIEWED') ? <p className="review-status-message" role="status">You have already reviewed this request.</p>
                : eligibilityError ? <ErrorMessage message="Unable to check review eligibility. Please try again." onRetry={reloadEligibility} />
                  : eligibilityLoading || !eligibilityIsCurrent ? <LoadingSpinner compact label="Checking review eligibility…" />
                    : eligibilityData?.canReview ? <><p className="muted">Share feedback about {eligibilityData.reviewedUser?.name || 'the other participant'}.</p><ReviewForm onSubmit={submitReview} /></> : null}
          </section>}
        </article>

        <aside className="offer-workspace" aria-label="Offers and negotiation">
          <section className="panel offer-panel offer-create-panel">
            {ownRequest ? <><span className="eyebrow">YOUR REQUEST</span><h2>Offers for your request</h2><p className="muted">Manage offers from students who want to help.</p></>
              : <><span className="eyebrow">LEND A HAND</span><h2>Want to help?</h2><p className="offer-reward-line">Request reward <strong>{formatCurrency(request.reward)}</strong></p></>}
            {ownRequest ? null : request.status === 'ACCEPTED' ? <p className="muted">This request has been accepted and is no longer open to offers.</p>
              : request.status === 'COMPLETED' ? <p className="muted">This request is complete and is no longer open to offers.</p>
                : request.status === 'CANCELLED' ? <p className="muted">This request was cancelled and is no longer open to offers.</p>
                  : !requestActive ? <p className="muted">This request is not accepting offers right now.</p>
                    : !user ? <><p className="muted">Log in to make an offer on this request.</p><Link className="button button-primary button-wide" to="/login">Log in to make an offer</Link></>
                      : offersLoading || (!offersFetchedForRequest && !offersError) ? <LoadingSpinner compact label="Checking your existing offers…" />
                        : offersError ? <ErrorMessage message="Unable to check your existing offers. Try again before submitting." onRetry={reloadOffers} />
                          : hasActiveOffer ? <p className="muted">You already have an offer in this negotiation. Check its latest status below.</p>
                        : myOfferHistory.some((offer) => offer.status === 'REJECTED') ? <><p className="muted">Your earlier offer was rejected. You can make a new offer if you still want to help.</p><ErrorMessage message={actionError} /><OfferForm onSubmit={submitOffer} submitting={submittingOffer} reward={null} /></>
                          : <><ErrorMessage message={actionError} /><OfferForm onSubmit={submitOffer} submitting={submittingOffer} reward={null} /></>}
            {ownRequest && <><ErrorMessage message={actionError} />{offersLoading || (!offersFetchedForRequest && !offersError) ? <LoadingSpinner compact label="Loading offers…" /> : offersError ? <ErrorMessage message="Unable to load offers. Please try again." onRetry={reloadOffers} /> : offers.length === 0 ? <p className="muted offers-empty-note">No offers yet. Students who want to help will appear here.</p> : <OfferHistory offers={offers} ownRequest requestActive={requestActive} onAction={(type, offer) => { setActionError(''); setDialog({ type, offer }); }} />}</>}
            {!ownRequest && myOfferHistory.length > 0 && <section className="helper-offer-history" aria-labelledby="your-offers-heading"><h3 id="your-offers-heading">Your offers for this request</h3>{offersLoading || !offersFetchedForRequest ? <LoadingSpinner compact label="Loading your offers…" /> : <OfferHistory offers={myOfferHistory} ownRequest={false} requestActive={requestActive} onAction={() => {}} />}</section>}
          </section>
        </aside>
      </div>

      <Modal open={Boolean(dialog)} title={dialog?.type === 'accept' ? 'Accept this offer?' : dialog?.type === 'reject' ? 'Reject this offer?' : dialog?.type === 'startFulfillment' ? 'Start this request?' : dialog?.type === 'completeFulfillment' ? 'Confirm completion?' : 'Make a counter offer'} onClose={() => { if (!processingAction) setDialog(null); }}
        actions={dialog?.type === 'counter' ? <button className="button button-quiet button-small" type="button" onClick={() => setDialog(null)} disabled={processingAction}>Cancel</button> : <><button className="button button-quiet button-small" type="button" onClick={() => setDialog(null)} disabled={processingAction}>Cancel</button><button className="button button-primary button-small" type="button" onClick={confirmAction} disabled={processingAction}>{processingAction ? dialog?.type === 'startFulfillment' ? 'Starting…' : dialog?.type === 'completeFulfillment' ? 'Completing…' : 'Please wait…' : dialog?.type === 'accept' ? 'Accept Offer' : dialog?.type === 'reject' ? 'Reject Offer' : dialog?.type === 'startFulfillment' ? 'Start Request' : 'Confirm Completion'}</button></>}>
        {dialog?.type === 'accept' && <p>Accept this offer for {formatCurrency(dialog.offer.proposedPrice)} from {dialog.offer.helper?.name || 'this student'}?</p>}
        {dialog?.type === 'reject' && <p>Reject this offer from {dialog.offer.helper?.name || 'this student'}? The offer will remain in the history as rejected.</p>}
        {dialog?.type === 'startFulfillment' && <p>You’ll be responsible for fulfilling this request.</p>}
        {dialog?.type === 'completeFulfillment' && <p>Confirm that you received the requested item or service.</p>}
        {dialog?.type === 'counter' && <OfferForm key={dialog.offer.id} initialPrice={dialog.offer.proposedPrice} onSubmit={counterOffer} submitting={processingAction} submitLabel="Send Counter" submittingLabel="Sending…" />}
        {dialog && <ErrorMessage message={dialog.type === 'startFulfillment' || dialog.type === 'completeFulfillment' ? fulfillmentActionError : actionError} />}
      </Modal>
    </section>
  );
}
