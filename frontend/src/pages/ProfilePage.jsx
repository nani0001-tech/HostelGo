import { useCallback } from 'react';
import EmptyState from '../components/EmptyState.jsx';
import ErrorMessage from '../components/ErrorMessage.jsx';
import LoadingSpinner from '../components/LoadingSpinner.jsx';
import RatingDisplay from '../components/RatingDisplay.jsx';
import ReviewCard from '../components/ReviewCard.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import useResource from '../hooks/useResource.js';
import { offerApi, requestApi, reviewApi } from '../services/api.js';

function ReviewSection({ title, mode, resource, emptyTitle, emptyDescription }) {
  const reviews = resource.data?.reviews || [];
  const reviewTotal = resource.data?.pagination?.total;
  return (
    <section className="profile-review-section" aria-labelledby={`${mode}-reviews-heading`}>
      <div className="profile-review-heading">
        <div><span className="eyebrow">COMMUNITY FEEDBACK</span><h2 id={`${mode}-reviews-heading`}>{title}</h2></div>
        <span className="muted">{Number.isSafeInteger(reviewTotal) ? `${reviewTotal} total · showing ${reviews.length} recent` : 'Recent reviews'}</span>
      </div>
      {resource.loading ? <LoadingSpinner compact label={`Loading ${title.toLowerCase()}…`} />
        : resource.error ? <ErrorMessage message={`Unable to load ${title.toLowerCase()}. Please try again.`} onRetry={resource.reload} />
          : reviews.length === 0 ? <EmptyState title={emptyTitle} message={emptyDescription} />
            : <div className="profile-review-list">{reviews.map((review) => <ReviewCard key={review.id || review._id} review={review} mode={mode} />)}</div>}
    </section>
  );
}

function ProfileActivity({ requests, offers }) {
  const retry = () => Promise.all([requests.reload(), offers.reload()]);
  return (
    <section className="profile-activity-section" aria-labelledby="profile-activity-heading">
      <div className="profile-review-heading"><div><span className="eyebrow">YOUR HOSTELGO ACTIVITY</span><h2 id="profile-activity-heading">Activity summary</h2></div></div>
      {requests.loading || offers.loading ? <LoadingSpinner compact label="Loading activity summary…" />
        : requests.error || offers.error ? <ErrorMessage message="Unable to load your activity summary. Please try again." onRetry={retry} />
          : <div className="profile-activity-grid">
            {Number.isSafeInteger(requests.data?.pagination?.total) && <article className="profile-activity-card"><span>Requests posted</span><strong>{requests.data.pagination.total}</strong></article>}
            {Array.isArray(offers.data?.offers) && <article className="profile-activity-card"><span>Offers &amp; counter-offers</span><strong>{offers.data.offers.length}</strong></article>}
          </div>}
    </section>
  );
}

export default function ProfilePage() {
  const { user } = useAuth();
  const userId = user?.id || user?._id;
  const requestsLoader = useCallback(() => requestApi.mine('page=1&limit=1'), []);
  const offersLoader = useCallback(() => offerApi.mine(), []);
  const receivedLoader = useCallback(() => reviewApi.forUser(userId, 'page=1&limit=10'), [userId]);
  const authoredLoader = useCallback(() => reviewApi.mine('page=1&limit=10'), []);
  const requests = useResource(requestsLoader, [requestsLoader]);
  const offers = useResource(offersLoader, [offersLoader]);
  const receivedReviews = useResource(receivedLoader, [receivedLoader]);
  const authoredReviews = useResource(authoredLoader, [authoredLoader]);

  return (
    <div className="page-content profile-page">
      <div className="page-heading"><div><span className="eyebrow">YOUR HOSTELGO ACCOUNT</span><h1>Profile</h1><p>Your student profile, activity, and community reviews.</p></div></div>
      <section className="panel profile-panel" aria-labelledby="profile-name">
        {user?.profileImage
          ? <img className="profile-avatar profile-avatar-image" src={user.profileImage} alt={`${user.name || 'Student'} profile`} />
          : <div className="profile-avatar" aria-hidden="true">{user?.name?.trim()?.[0]?.toUpperCase() || 'S'}</div>}
        <div className="profile-identity">
          <h2 id="profile-name">{user?.name}</h2>
          {user?.email && <p className="muted">{user.email}</p>}
          <RatingDisplay rating={user?.rating} count={user?.ratingCount} />
        </div>
        {(user?.hostel || user?.phone) && <div className="profile-divider" />}
        {(user?.hostel || user?.phone) && <dl className="profile-details">
          {user?.hostel && <div><dt>Hostel</dt><dd>{user.hostel}</dd></div>}
          {user?.phone && <div><dt>Phone</dt><dd>{user.phone}</dd></div>}
        </dl>}
      </section>
      <ProfileActivity requests={requests} offers={offers} />
      <ReviewSection title="Reviews received" mode="received" resource={receivedReviews} emptyTitle="No reviews yet" emptyDescription="Reviews from students you have helped or requested help from will appear here." />
      <ReviewSection title="Reviews written" mode="authored" resource={authoredReviews} emptyTitle="No reviews written yet" emptyDescription="After a completed request, your review of the other participant will appear here." />
    </div>
  );
}
