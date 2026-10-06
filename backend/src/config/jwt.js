import jwt from 'jsonwebtoken';

export function signAuthToken(userId) {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET is not configured.');
  }

  return jwt.sign({}, secret, {
    algorithm: 'HS256',
    subject: userId.toString(),
    expiresIn: '1h',
  });
}

export function verifyAuthToken(token) {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET is not configured.');
  }

  return jwt.verify(token, secret, { algorithms: ['HS256'] });
}
