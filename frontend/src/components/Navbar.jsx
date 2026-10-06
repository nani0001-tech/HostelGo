import { useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import NotificationBadge from './NotificationBadge.jsx';

const links = [
  { to: '/dashboard', label: 'Dashboard' }, { to: '/requests', label: 'Browse Requests' },
  { to: '/my-requests', label: 'My Requests', private: true }, { to: '/offers', label: 'My Offers', private: true },
  { to: '/notifications', label: 'Notifications', private: true, badge: true },
];

export default function Navbar() {
  const { user, isAuthenticated, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const navigate = useNavigate();
  const visibleLinks = links.filter((link) => !link.private || isAuthenticated);

  async function handleLogout() {
    await logout();
    setMenuOpen(false);
    navigate('/login');
  }

  return (
    <header className="site-header">
      <div className="nav-inner">
        <Link className="brand" to={isAuthenticated ? '/dashboard' : '/'} aria-label="HostelGo home"><span className="brand-mark">H</span><span>hostelgo<span className="brand-period">.</span></span></Link>
        <button className="mobile-menu-toggle" type="button" aria-expanded={menuOpen} aria-controls="hostelgo-main-navigation" aria-label={menuOpen ? 'Close navigation' : 'Open navigation'} onClick={() => setMenuOpen((open) => !open)}><span /><span /><span /></button>
        <nav id="hostelgo-main-navigation" className={`main-nav${menuOpen ? ' nav-open' : ''}`} aria-label="Main navigation">
          {visibleLinks.map((link) => <NavLink key={link.to} to={link.to} onClick={() => setMenuOpen(false)} className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
            {link.badge && <span aria-hidden="true">🔔</span>}{link.label}{link.badge && <NotificationBadge />}
          </NavLink>)}
          {isAuthenticated && <NavLink className={({ isActive }) => `nav-profile${isActive ? ' active' : ''}`} to="/profile" onClick={() => setMenuOpen(false)}><span className="avatar avatar-small" aria-hidden="true">{user?.name?.[0] || 'S'}</span><span className="nav-user-name">{user?.name?.split(' ')[0]}</span></NavLink>}
          {isAuthenticated
            ? <button className="nav-logout" onClick={handleLogout} type="button">Log out</button>
            : <div className="nav-auth-actions"><Link to="/login" onClick={() => setMenuOpen(false)} className="nav-login">Log in</Link><Link to="/register" onClick={() => setMenuOpen(false)} className="button button-primary button-small">Join HostelGo</Link></div>}
        </nav>
      </div>
    </header>
  );
}
