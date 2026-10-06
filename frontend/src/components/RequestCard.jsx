import { Link, useLocation } from 'react-router-dom';
import StatusBadge from './StatusBadge.jsx';
import { formatCurrency, formatDateTime } from '../utils/formatters.js';

export default function RequestCard({ request }) {
  const owner = request.requester || {};
  const location = useLocation();
  const requestId = request._id || request.id;
  const detailPath = `/requests/${requestId}`;
  const detailState = { from: { pathname: location.pathname, search: location.search } };
  const itemName = request.item || 'Request';
  const status = request.status || 'OPEN';
  const acceptedPrice = request.acceptedPrice ?? request.acceptedOffer?.proposedPrice;
  const hasAgreedPrice = ['ACCEPTED', 'IN_PROGRESS', 'COMPLETED'].includes(status) && acceptedPrice != null;

  return (
    <article className="request-card">
      <div className="request-card-top"><span className="category-pill">{request.category || 'Other'}</span><StatusBadge status={request.status} /></div>
      <Link className="request-title" to={detailPath} state={detailState}>{itemName}</Link>
      <div className="request-facts">
        <span><b>Quantity</b> {request.quantity ?? '—'}</span>
        <span><b>{hasAgreedPrice ? 'Agreed price' : 'Reward'}</b> {formatCurrency(hasAgreedPrice ? acceptedPrice : request.reward)}</span>
      </div>
      <div className="request-meta">
        <span><span aria-hidden="true">⌖</span> {request.location || 'Location not specified'}</span>
        <span><span aria-hidden="true">◷</span> {formatDateTime(request.requiredTime)}</span>
        {request.createdAt && <span><b>Posted</b> {formatDateTime(request.createdAt)}</span>}
      </div>
      <div className="request-card-footer">
        <span className="person-chip">
          {owner.profileImage
            ? <img className="avatar avatar-small" src={owner.profileImage} alt="" />
            : <span className="avatar avatar-small" aria-hidden="true">{owner.name?.trim()?.[0]?.toUpperCase() || 'S'}</span>}
          <span>{owner.name || 'Hostel student'} <small>{owner.ratingCount > 0 ? <><span aria-hidden="true">★</span> {Number(owner.rating || 0).toFixed(1)} ({owner.ratingCount})</> : 'No reviews yet'}</small></span>
        </span>
        <div className="request-card-links">
          <Link className="request-view-details" to={detailPath} state={detailState}>View details <span aria-hidden="true">→</span></Link>
          {status === 'COMPLETED' && <Link className="request-view-details request-review-link" to={`${detailPath}#request-review`} state={detailState}>Review</Link>}
        </div>
      </div>
    </article>
  );
}
