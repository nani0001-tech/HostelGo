const API_BASE_URL = (import.meta.env.VITE_API_URL || 'http://localhost:5000/api').replace(/\/$/, '');
const TOKEN_KEY = 'hostelgo.token';
let unauthorizedHandler = null;

export function getToken() { return localStorage.getItem(TOKEN_KEY); }
export function saveToken(token) { localStorage.setItem(TOKEN_KEY, token); }
export function clearToken() { localStorage.removeItem(TOKEN_KEY); }
export function setUnauthorizedHandler(handler) { unauthorizedHandler = handler; }

export class ApiError extends Error {
  constructor(message, status = 0) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

export async function apiRequest(path, { method = 'GET', body, auth = true } = {}) {
  const token = auth ? getToken() : null;
  let response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers: {
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  } catch {
    throw new ApiError('Unable to connect to HostelGo. Check your connection and try again.');
  }

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 401 && auth) unauthorizedHandler?.();
    const message = response.status >= 500
      ? 'Something went wrong on our end. Please try again in a moment.'
      : payload.message || 'Something went wrong. Please try again.';
    throw new ApiError(message, response.status);
  }
  return payload;
}

export const authApi = {
  login: (credentials) => apiRequest('/auth/login', { method: 'POST', body: credentials, auth: false }),
  register: (details) => apiRequest('/auth/register', { method: 'POST', body: details, auth: false }),
  me: () => apiRequest('/auth/me'),
  logout: () => apiRequest('/auth/logout', { method: 'POST' }),
};

export const requestApi = {
  list: (params = '') => apiRequest(`/requests${params ? `?${params}` : ''}`, { auth: false }),
  get: (id) => apiRequest(`/requests/${encodeURIComponent(id)}`, { auth: false }),
  mine: (params = '') => apiRequest(`/requests/my${params ? `?${params}` : ''}`),
  create: (request) => apiRequest('/requests', { method: 'POST', body: request }),
  start: (id) => apiRequest(`/requests/${encodeURIComponent(id)}/start`, { method: 'PUT' }),
  complete: (id) => apiRequest(`/requests/${encodeURIComponent(id)}/complete`, { method: 'PUT' }),
  update: (id, changes) => apiRequest(`/requests/${encodeURIComponent(id)}`, { method: 'PUT', body: changes }),
  cancel: (id) => apiRequest(`/requests/${encodeURIComponent(id)}/cancel`, { method: 'PUT' }),
};

export const offerApi = {
  mine: () => apiRequest('/offers/my'),
  forRequest: (requestId) => apiRequest(`/requests/${encodeURIComponent(requestId)}/offers`),
  create: (requestId, offer) => apiRequest(`/requests/${encodeURIComponent(requestId)}/offers`, { method: 'POST', body: offer }),
  accept: (id) => apiRequest(`/offers/${encodeURIComponent(id)}/accept`, { method: 'PUT' }),
  reject: (id) => apiRequest(`/offers/${encodeURIComponent(id)}/reject`, { method: 'PUT' }),
  counter: (id, offer) => apiRequest(`/offers/${encodeURIComponent(id)}/counter`, { method: 'POST', body: offer }),
};

export const reviewApi = {
  mine: (params = '') => apiRequest(`/reviews/my${params ? `?${params}` : ''}`),
  forUser: (id, params = '') => apiRequest(`/users/${encodeURIComponent(id)}/reviews${params ? `?${params}` : ''}`, { auth: false }),
  canReview: (requestId) => apiRequest(`/reviews/can-review/${encodeURIComponent(requestId)}`),
  create: (review) => apiRequest('/reviews', { method: 'POST', body: review }),
};

export const notificationApi = {
  list: (params = '') => apiRequest(`/notifications${params ? `?${params}` : ''}`),
  unreadCount: () => apiRequest('/notifications/unread-count'),
  markRead: (id) => apiRequest(`/notifications/${encodeURIComponent(id)}/read`, { method: 'PUT' }),
  markAllRead: () => apiRequest('/notifications/read-all', { method: 'PUT' }),
};
