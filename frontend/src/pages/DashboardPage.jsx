import { Link } from 'react-router-dom';
import EmptyState from '../components/EmptyState.jsx';
import ErrorMessage from '../components/ErrorMessage.jsx';
import LoadingSpinner from '../components/LoadingSpinner.jsx';
import OfferCard from '../components/OfferCard.jsx';
import RequestCard from '../components/RequestCard.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useNotifications } from '../context/NotificationContext.jsx';
import useResource from '../hooks/useResource.js';
import { offerApi, requestApi } from '../services/api.js';

export default function DashboardPage() {
  const { user } = useAuth();
  const { unreadCount, loading: unreadLoading } = useNotifications();
  const { data, loading, error, reload } = useResource(async () => {
    const [available, mine, offers] = await Promise.all([requestApi.list('limit=6'), requestApi.mine('limit=5'), offerApi.mine()]);
    return { available: available.requests || [], mine: mine.requests || [], offers: offers.offers || [] };
  });
  const activeRequests = data?.mine?.filter((request) => ['OPEN', 'NEGOTIATING', 'ACCEPTED', 'IN_PROGRESS'].includes(request.status)) || [];
  const activeCount = activeRequests.length;

  return (
    <div className="dashboard-page">
      <section className="welcome-panel" aria-labelledby="dashboard-welcome">
        <div className="welcome-copy">
          <span className="eyebrow">YOUR HOSTEL, YOUR COMMUNITY</span>
          <h1 id="dashboard-welcome">Welcome to HostelGo</h1>
          <p>{user?.name ? `Hi ${user.name.split(' ')[0]}, what can we make easier today?` : 'What can we make easier today?'}</p>
        </div>
        <nav className="dashboard-actions" aria-label="Dashboard actions">
          <Link className="button button-primary" to="/requests/new">Create a request</Link>
          <Link className="button button-quiet" to="/requests">Browse requests</Link>
          <Link className="dashboard-action-link" to="/my-requests">My requests</Link>
          <Link className="dashboard-action-link" to="/my-offers">My offers</Link>
        </nav>
      </section>
      <ErrorMessage message={error} onRetry={reload} />
      <section className="stats-grid">
        <div className="stat-card"><span className="stat-icon icon-sage" aria-hidden="true">⌂</span><span className="stat-label">Active in latest 5 requests</span><strong>{loading ? '—' : activeCount}</strong><Link to="/my-requests">View requests ↗</Link></div>
        <div className="stat-card"><span className="stat-icon icon-peach">↗</span><span className="stat-label">My offers</span><strong>{loading ? '—' : data?.offers?.length || 0}</strong><Link to="/offers">View offers ↗</Link></div>
        <div className="stat-card"><span className="stat-icon icon-yellow">★</span><span className="stat-label">Your rating</span><strong>{Number(user?.rating || 0).toFixed(1)} <small>/ 5</small></strong><span className="stat-footnote">{user?.ratingCount || 0} student reviews</span></div>
        <div className="stat-card"><span className="stat-icon icon-peach">♧</span><span className="stat-label">Unread updates</span><strong>{loading || unreadLoading ? '—' : unreadCount}</strong><Link to="/notifications">View notifications ↗</Link></div>
      </section>
      <section className="section-block"><div className="section-title-row"><div><span className="eyebrow">A HAND IS CLOSE BY</span><h2>Available requests</h2></div><Link to="/requests" className="subtle-link">Browse all <span>↗</span></Link></div>{loading ? <LoadingSpinner label="Loading your dashboard…" /> : data?.available?.length ? <div className="request-grid">{data.available.slice(0, 3).map((request) => <RequestCard key={request._id || request.id} request={request} />)}</div> : <EmptyState title="No open requests yet" message="Start with yours, or check back a little later." action="Create a request" to="/requests/new" />}</section>
      <div className="dashboard-lower"><section className="section-block"><div className="section-title-row"><div><span className="eyebrow">YOUR REQUESTS</span><h2>My active requests</h2></div><Link to="/my-requests" className="subtle-link">See all</Link></div>{loading ? <LoadingSpinner compact /> : activeRequests.length ? <div className="compact-list">{activeRequests.slice(0, 3).map((request) => <RequestCard key={request._id || request.id} request={request} />)}</div> : <EmptyState title="Nothing in progress" message="Requests you post will show up here." />}</section>
        <section className="section-block"><div className="section-title-row"><div><span className="eyebrow">LENDING A HAND</span><h2>My offers</h2></div><Link to="/offers" className="subtle-link">See all</Link></div>{loading ? <LoadingSpinner compact /> : data?.offers?.length ? <div className="offer-list">{data.offers.slice(0, 3).map((offer) => <OfferCard key={offer.id} offer={offer} />)}</div> : <EmptyState title="No offers yet" message="Offer to help with a request and it’ll appear here." />}</section></div>
    </div>
  );
}
