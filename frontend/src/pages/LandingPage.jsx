import { Link } from 'react-router-dom';
import EmptyState from '../components/EmptyState.jsx';
import ErrorMessage from '../components/ErrorMessage.jsx';
import LoadingSpinner from '../components/LoadingSpinner.jsx';
import RequestCard from '../components/RequestCard.jsx';
import useResource from '../hooks/useResource.js';
import { requestApi } from '../services/api.js';
import { useAuth } from '../context/AuthContext.jsx';

const categories = [
  ['▧', 'Groceries'], ['☕', 'Food'], ['✚', 'Medicine'], ['✎', 'Stationery'], ['⌁', 'Tools'],
];

export default function LandingPage() {
  const { isAuthenticated } = useAuth();
  const { data, loading, error, reload } = useResource(() => requestApi.list('limit=3'));
  return (
    <>
      <section className="landing-hero">
        <div className="hero-copy">
          <span className="eyebrow"><span className="eyebrow-star">✳</span> THE HOSTEL COMMUNITY MARKETPLACE</span>
          <h1>Need a hands?<br /><em>Ask your people.</em></h1>
          <p>The little things are easier together. Get everyday essentials from someone right around the corner.</p>
          <div className="hero-actions"><Link className="button button-primary" to={isAuthenticated ? '/requests' : '/register'}>{isAuthenticated ? 'Explore requests' : 'Get started'} <span>↗</span></Link><Link className="hero-secondary" to="/requests">Browse requests</Link></div>
          <div className="hero-trust"><span className="avatar-stack"><i>A</i><i>R</i><i>S</i></span> Made for hostel life</div>
        </div>
        <div className="hero-art" aria-label="A bag of hostel essentials" role="img"><div className="hero-sun" /><span className="hero-spark spark-a">✳</span><span className="hero-spark spark-b">✦</span><div className="hero-bag"><div className="bag-handle" /><div className="bag-face">H</div><span className="bag-leaf" /><span className="bag-box">✺</span><span className="bag-bottle" /></div><div className="hero-ground" /><div className="hero-float"><span className="float-check">✓</span><span><strong>On its way</strong><small>From a neighbor nearby</small></span></div></div>
      </section>
      <section className="category-section"><div className="section-title-row"><div><span className="eyebrow">A LITTLE BIT OF EVERYTHING</span><h2>What do you need?</h2></div><Link to="/requests" className="subtle-link">See requests <span>↗</span></Link></div><div className="category-grid">{categories.map(([icon, label], index) => <Link to="/requests" className="category-tile" key={label}><span className={`category-icon category-${index}`}>{icon}</span><span>{label}</span><span className="tile-arrow">↗</span></Link>)}</div></section>
      <section className="section-block"><div className="section-title-row"><div><span className="eyebrow">NEARBY STUDENTS</span><h2>Requests around you</h2></div><Link to="/requests" className="subtle-link">Browse all <span>↗</span></Link></div><ErrorMessage message={error} onRetry={reload} />{loading ? <LoadingSpinner label="Finding open requests…" /> : data?.requests?.length ? <div className="request-grid">{data.requests.map((request) => <RequestCard key={request._id || request.id} request={request} />)}</div> : <EmptyState title="It’s quiet for now" message="Check back soon for requests from your hostel community." />}</section>
    </>
  );
}
