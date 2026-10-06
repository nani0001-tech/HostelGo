export function destinationAfterAuth(from) {
  if (typeof from?.pathname !== 'string' || !from.pathname.startsWith('/') || from.pathname.startsWith('//')) {
    return '/dashboard';
  }
  return `${from.pathname}${from.search || ''}${from.hash || ''}`;
}
