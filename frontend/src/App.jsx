import { Navigate, Route, Routes } from 'react-router-dom';
import ProtectedRoute from './components/ProtectedRoute.jsx';
import AppLayout from './layouts/AppLayout.jsx';
import CreateRequestPage from './pages/CreateRequestPage.jsx';
import DashboardPage from './pages/DashboardPage.jsx';
import LandingPage from './pages/LandingPage.jsx';
import LoginPage from './pages/LoginPage.jsx';
import MyOffersPage from './pages/MyOffersPage.jsx';
import MyRequestsPage from './pages/MyRequestsPage.jsx';
import NotificationsPage from './pages/NotificationsPage.jsx';
import ProfilePage from './pages/ProfilePage.jsx';
import RegisterPage from './pages/RegisterPage.jsx';
import RequestDetailPage from './pages/RequestDetailPage.jsx';
import RequestsPage from './pages/RequestsPage.jsx';

function SignedIn({ children }) {
  return <ProtectedRoute>{children}</ProtectedRoute>;
}

export default function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<LandingPage />} />
        <Route path="login" element={<LoginPage />} />
        <Route path="register" element={<RegisterPage />} />
        <Route path="dashboard" element={<SignedIn><DashboardPage /></SignedIn>} />
        <Route path="requests" element={<RequestsPage />} />
        <Route path="requests/new" element={<SignedIn><CreateRequestPage /></SignedIn>} />
        <Route path="requests/create" element={<SignedIn><CreateRequestPage /></SignedIn>} />
        <Route path="requests/:id" element={<RequestDetailPage />} />
        <Route path="my-requests" element={<SignedIn><MyRequestsPage /></SignedIn>} />
        <Route path="offers" element={<SignedIn><MyOffersPage /></SignedIn>} />
        <Route path="my-offers" element={<SignedIn><MyOffersPage /></SignedIn>} />
        <Route path="notifications" element={<SignedIn><NotificationsPage /></SignedIn>} />
        <Route path="profile" element={<SignedIn><ProfilePage /></SignedIn>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
