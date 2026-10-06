import { useCallback, useState } from 'react';
import { Link } from 'react-router-dom';
import EmptyState from '../components/EmptyState.jsx';
import ErrorMessage from '../components/ErrorMessage.jsx';
import LoadingSpinner from '../components/LoadingSpinner.jsx';
import RequestCard from '../components/RequestCard.jsx';
import useResource from '../hooks/useResource.js';
import { requestApi } from '../services/api.js';

const categories = ['FOOD', 'GROCERIES', 'MEDICINE', 'STATIONERY', 'TOOLS', 'OTHER'];
const PAGE_SIZE = 9;

export default function RequestsPage() {
  const [category, setCategory] = useState('');
  const [page, setPage] = useState(1);
  const loader = useCallback(() => {
    const params = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) });
    if (category) params.set('category', category);
    return requestApi.list(params.toString());
  }, [category, page]);
  const { data, loading, error, reload } = useResource(loader, [loader]);
  const requests = data?.requests || [];
  const pagination = data?.pagination;
  const totalPages = Number(pagination?.totalPages) || 0;

  return (
    <section className="page-content requests-page" aria-labelledby="browse-requests-title">
      <div className="page-heading">
        <div>
          <span className="eyebrow">THE HOSTELGO COMMUNITY</span>
          <h1 id="browse-requests-title">Browse Requests</h1>
          <p>Find requests from students who need help.</p>
        </div>
        <Link className="button button-primary" to="/requests/new"><span aria-hidden="true">+</span> Create Request</Link>
      </div>

      <div className="request-browse-toolbar">
        <label className="select-filter" htmlFor="request-category">Category
          <select id="request-category" value={category} onChange={(event) => { setCategory(event.target.value); setPage(1); }}>
            <option value="">All categories</option>
            {categories.map((option) => <option key={option} value={option}>{option[0] + option.slice(1).toLowerCase()}</option>)}
          </select>
        </label>
        {pagination && <span className="muted" aria-live="polite">{pagination.total} open {pagination.total === 1 ? 'request' : 'requests'}</span>}
      </div>

      <ErrorMessage message={error} onRetry={reload} />
      {loading ? <LoadingSpinner label="Finding requests…" /> : requests.length > 0 ? (
        <>
          <div className="request-grid" aria-label="Open requests">
            {requests.map((request) => <RequestCard key={request._id || request.id} request={request} />)}
          </div>
          {pagination && totalPages > 1 && (
            <nav className="request-pagination" aria-label="Request pages">
              <button className="button button-quiet button-small" type="button" disabled={page <= 1 || loading} onClick={() => setPage((current) => Math.max(1, current - 1))}>Previous</button>
              <span aria-live="polite">Page {pagination.page} of {totalPages}</span>
              <button className="button button-quiet button-small" type="button" disabled={page >= totalPages || loading} onClick={() => setPage((current) => Math.min(totalPages, current + 1))}>Next</button>
            </nav>
          )}
        </>
      ) : page > 1 ? (
        <EmptyState title="No requests on this page" message="The available requests may have changed. Go back to the previous page." action={{ label: 'Previous page', onClick: () => setPage((current) => Math.max(1, current - 1)) }} />
      ) : (
        <EmptyState title="No requests found" message="Try another category, or be the first to post a request." action="Create Request" to="/requests/new" />
      )}
    </section>
  );
}
