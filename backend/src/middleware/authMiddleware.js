import mongoose from 'mongoose';
import User from '../models/User.js';
import { verifyAuthToken } from '../config/jwt.js';

export default async function authMiddleware(req, res, next) {
  const authorization = req.get('Authorization');
  const match = authorization?.match(/^Bearer\s+([^\s]+)$/i);

  if (!match) {
    return res.status(401).json({ message: 'A valid Bearer token is required.' });
  }

  try {
    const payload = verifyAuthToken(match[1]);
    if (typeof payload === 'string' || !mongoose.isValidObjectId(payload.sub)) {
      return res.status(401).json({ message: 'Invalid or expired token.' });
    }

    const user = await User.findById(payload.sub);
    if (!user) {
      return res.status(401).json({ message: 'Invalid or expired token.' });
    }

    req.user = user;
    return next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError' || error.name === 'NotBeforeError') {
      return res.status(401).json({ message: 'Invalid or expired token.' });
    }
    return next(error);
  }
}
