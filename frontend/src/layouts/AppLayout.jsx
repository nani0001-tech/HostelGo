import { Outlet } from 'react-router-dom';
import Navbar from '../components/Navbar.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { NotificationProvider } from '../context/NotificationContext.jsx';
import LoadingSpinner from '../components/LoadingSpinner.jsx';

export default function AppLayout() {
  const { loading, isAuthenticated } = useAuth();
  return <NotificationProvider enabled={isAuthenticated}><Navbar /><main className="app-main">{loading ? <LoadingSpinner label="Getting things ready…" /> : <Outlet />}</main><footer className="site-footer"><span>Good neighbors make a good hostel.</span><span>HostelGo <b>✳</b></span></footer></NotificationProvider>;
}
