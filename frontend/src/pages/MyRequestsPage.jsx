import { useCallback } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import EmptyState from '../components/EmptyState.jsx';
import ErrorMessage from '../components/ErrorMessage.jsx';
import LoadingSpinner from '../components/LoadingSpinner.jsx';
import RequestCard from '../components/RequestCard.jsx';
import useResource from '../hooks/useResource.js';
import { requestApi } from '../services/api.js';

const filters = [
  { value: 'ALL', label: 'All statuses' },
  { value: 'ACTIVE', label: 'Open / Negotiating' },
  { value: 'ACCEPTED', label: 'Accepted / In Progress' },
  { value: 'COMPLETED', label: 'Completed' },
  { value: 'CANCELLED', label: 'Cancelled' },
];
const filterStatuses = {
  ACTIVE: ['OPEN', 'NEGOTIATING'],
  ACCEPTED: ['ACCEPTED', 'IN_PROGRESS'],
  COMPLETED: ['COMPLETED'],
  CANCELLED: ['CANCELLED'],
};

export default function MyRequestsPage() {
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const rawPage = Number(searchParams.get('page') || 1);
  const page = Number.isSafeInteger(rawPage) && rawPage > 0 ? rawPage : 1;
  const requestedFilter = searchParams.get('status') || 'ALL';
  const statusFilter = filters.some((filter) => filter.value === requestedFilter) ? requestedFilter : 'ALL';
  const loadRequests = useCallback(() => requestApi.mine(`page=${page}&limit=20`), [page]);
  const { data, loading, error, reload } = useResource(loadRequests, [loadRequests]);
  const requests = data?.requests || [];
  const visibleRequests = statusFilter === 'ALL'
    ? requests
    : requests.filter((request) => filterStatuses[statusFilter]?.includes(request.status));
  const pagination = data?.pagination;
  const pageChanging = Boolean(pagination && page !== pagination.page);

  function updateHistory(nextPage, nextFilter = statusFilter) {
    const next = new URLSearchParams(searchParams);
    if (nextPage <= 1) next.delete('page');
    else next.set('page', String(nextPage));
    if (nextFilter === 'ALL') next.delete('status');
    else next.set('status', nextFilter);
    setSearchParams(next);
  }

  const emptyTitle = statusFilter === 'ALL' ? 'No requests posted yet' : `No ${filters.find((filter) => filter.value === statusFilter)?.label.toLowerCase()} requests on this page`;
  const emptyMessage = statusFilter === 'ALL'
    ? 'Post your first errand and let the community lend a hand.'
    : 'Try another status or check the other pages in your request history.';

  return (
    <section className="page-content requests-page history-page" aria-labelledby="my-requests-title">
      <div className="page-heading"><div><span className="eyebrow">YOUR HOSTEL ERRANDS</span><h1 id="my-requests-title">My requests</h1><p>Review active errands and requests you have completed or cancelled.</p></div><Link className="button button-primary" to="/requests/new">＋ Create a request</Link></div>
      {location.state?.requestCreated && <div className="request-created-banner" role="status"><span aria-hidden="true">✓</span> Your request was created. It will appear here shortly.</div>}
      <ErrorMessage message={error ? 'Unable to load your requests. Please try again.' : ''} onRetry={reload} />
      {!loading && requests.length > 0 && <div className="history-filter-row" role="group" aria-label="Filter requests by status">
        {filters.map((filter) => <button key={filter.value} className={`offer-filter${statusFilter === filter.value ? ' is-selected' : ''}`} type="button" aria-pressed={statusFilter === filter.value} onClick={() => updateHistory(1, filter.value)}>{filter.label}</button>)}
      </div>}
      {loading ? <LoadingSpinner label="Loading your requests…" />
        : visibleRequests.length > 0 ? <>
          {pagination && <p className="history-result-summary">Showing {visibleRequests.length} {visibleRequests.length === 1 ? 'request' : 'requests'} on this page · {pagination.total} total</p>}
          <div className="request-grid">{visibleRequests.map((request) => <RequestCard key={request._id || request.id} request={request} />)}</div>
          {pagination && pagination.totalPages > 1 && <nav className="request-pagination" aria-label="My request pages">
            <button className="button button-quiet button-small" type="button" onClick={() => updateHistory(Math.max(1, page - 1))} disabled={loading || pageChanging || pagination.page <= 1}>Previous</button>
            <span>Page {pagination.page} of {pagination.totalPages}</span>
            <button className="button button-quiet button-small" type="button" onClick={() => updateHistory(page + 1)} disabled={loading || pageChanging || pagination.page >= pagination.totalPages}>Next</button>
          </nav>}
        </> : <EmptyState title={emptyTitle} message={emptyMessage} action={statusFilter === 'ALL' ? 'Create a request' : undefined} to={statusFilter === 'ALL' ? '/requests/new' : undefined} />}
    </section>
  );
}
