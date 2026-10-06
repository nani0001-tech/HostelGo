import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import EmptyState from '../components/EmptyState.jsx';
import ErrorMessage from '../components/ErrorMessage.jsx';
import LoadingSpinner from '../components/LoadingSpinner.jsx';
import OfferCard from '../components/OfferCard.jsx';
import useResource from '../hooks/useResource.js';
import { offerApi } from '../services/api.js';

const filters = [
  { value: 'ALL', label: 'All' },
  { value: 'PENDING', label: 'Pending' },
  { value: 'ACCEPTED', label: 'Accepted' },
  { value: 'REJECTED', label: 'Rejected' },
  { value: 'COUNTERED', label: 'Countered' },
];

export default function MyOffersPage() {
  const [status, setStatus] = useState('ALL');
  const { data, loading, error, reload } = useResource(() => offerApi.mine());
  const offers = data?.offers || [];
  const visibleOffers = useMemo(() => status === 'ALL' ? offers : offers.filter((offer) => offer.status === status), [offers, status]);

  return (
    <section className="page-content offers-page" aria-labelledby="my-offers-title">
      <div className="page-heading">
        <div><span className="eyebrow">YOUR GOOD NEIGHBOR MOMENTS</span><h1 id="my-offers-title">My Offers</h1><p>Follow the offers and counter-offers you’ve made around your hostel.</p></div>
        <Link className="button button-quiet" to="/requests">Browse requests</Link>
      </div>
      <ErrorMessage message={error} onRetry={reload} />
      {!loading && offers.length > 0 && <div className="offer-filter-row" role="group" aria-label="Filter offers by status">
        {filters.map((filter) => <button key={filter.value} className={`offer-filter${status === filter.value ? ' is-selected' : ''}`} type="button" aria-pressed={status === filter.value} onClick={() => setStatus(filter.value)}>{filter.label}{filter.value === 'ALL' ? <span>{offers.length}</span> : <span>{offers.filter((offer) => offer.status === filter.value).length}</span>}</button>)}
      </div>}
      {loading ? <LoadingSpinner label="Loading your offers…" /> : visibleOffers.length > 0
        ? <div className="offer-list offer-list-page">{visibleOffers.map((offer) => <OfferCard key={offer.id} offer={offer} />)}</div>
        : offers.length > 0
          ? <EmptyState title={`No ${status.toLowerCase()} offers`} message="Choose another status filter to see more of your offer history." />
          : <EmptyState title="No offers yet" message="A nearby student might need your help with an errand." action="Browse requests" to="/requests" />}
    </section>
  );
}
