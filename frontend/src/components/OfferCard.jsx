import { Link, useLocation } from 'react-router-dom';
import StatusBadge from './StatusBadge.jsx';
import { formatCurrency, formatDateTime } from '../utils/formatters.js';

export default function OfferCard({ offer }) {
  const location = useLocation();
  const request = offer.request || {};
  const title = request.item || 'Request offer';
  const isAcceptedOffer = offer.status === 'ACCEPTED';
  const agreedPrice = isAcceptedOffer && request.acceptedPrice != null ? request.acceptedPrice : null;
  const detailPath = offer.requestId ? `/requests/${offer.requestId}` : null;
  const card = <>
    <div className="offer-card-main">
      <div className="offer-icon" aria-hidden="true">{'\u2197'}</div>
      <div className="offer-card-copy">
        <h3>{title}</h3>
        <p>{offer.createdByRole === 'REQUESTER' ? 'Your counter offer' : `Your offer for ${request.category?.toLowerCase() || 'this request'}`}</p>
        {offer.message && <p className="offer-card-message">{offer.message}</p>}
        {offer.createdAt && <time dateTime={offer.createdAt}>{formatDateTime(offer.createdAt)}</time>}
        {request.status && <span className="offer-request-status">Request <StatusBadge status={request.status} /></span>}
      </div>
    </div>
    <div className="offer-card-side">
      <span className="offer-price-line"><span>Proposed</span><strong>{formatCurrency(offer.proposedPrice)}</strong></span>
      {agreedPrice != null && <span className="offer-price-line offer-agreed-price"><span>Agreed</span><strong>{formatCurrency(agreedPrice)}</strong></span>}
      <StatusBadge status={offer.status} />
      {detailPath && <span className="offer-view-request">View Request <span aria-hidden="true">{'\u2192'}</span></span>}
    </div>
  </>;
  return detailPath
    ? <Link className="offer-card" to={detailPath} state={{ from: { pathname: location.pathname, search: location.search } }} aria-label={`${title}, ${offer.status?.toLowerCase() || 'offer'}, proposed ${formatCurrency(offer.proposedPrice)}${agreedPrice == null ? '' : `, agreed ${formatCurrency(agreedPrice)}`}`}>{card}</Link>
    : <article className="offer-card">{card}</article>;
}
