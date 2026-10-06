import bcrypt from 'bcrypt';
import User from '../models/User.js';
import { signAuthToken } from '../config/jwt.js';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const BCRYPT_ROUNDS = 12;
const MAX_BCRYPT_PASSWORD_BYTES = 72;

export function toSafeUser(user) {
  return {
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    phone: user.phone,
    hostel: user.hostel,
    profileImage: user.profileImage,
    rating: user.rating,
    ratingCount: user.ratingCount,
    createdAt: user.createdAt,
  };
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

export async function register(req, res, next) {
  const body = req.body && typeof req.body === 'object' && !Array.isArray(req.body) ? req.body : {};
  const { name, email, password, phone, hostel } = body;

  if (!isNonEmptyString(name) || !isNonEmptyString(email) || typeof password !== 'string' || password.length === 0) {
    return res.status(400).json({ message: 'Name, email, and password are required.' });
  }

  if ((phone !== undefined && typeof phone !== 'string') || (hostel !== undefined && typeof hostel !== 'string')) {
    return res.status(400).json({ message: 'Phone and hostel must be strings.' });
  }

  const normalizedEmail = email.trim().toLowerCase();
  if (!EMAIL_PATTERN.test(normalizedEmail)) {
    return res.status(400).json({ message: 'Enter a valid email address.' });
  }

  if ([...password].length < 8 || Buffer.byteLength(password, 'utf8') > MAX_BCRYPT_PASSWORD_BYTES) {
    return res.status(400).json({ message: 'Password must be at least 8 characters and no more than 72 UTF-8 bytes.' });
  }

  try {
    const existingUser = await User.exists({ email: normalizedEmail });
    if (existingUser) {
      return res.status(409).json({ message: 'An account with this email already exists.' });
    }

    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const user = await User.create({
      name: name.trim(),
      email: normalizedEmail,
      password: passwordHash,
      phone: phone?.trim(),
      hostel: hostel?.trim(),
    });

    return res.status(201).json({ user: toSafeUser(user) });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ message: 'An account with this email already exists.' });
    }
    if (error.name === 'ValidationError') {
      return res.status(400).json({ message: 'The account details are invalid.' });
    }
    return next(error);
  }
}

export async function login(req, res, next) {
  const body = req.body && typeof req.body === 'object' && !Array.isArray(req.body) ? req.body : {};
  const { email, password } = body;

  if (!isNonEmptyString(email) || typeof password !== 'string' || password.length === 0) {
    return res.status(400).json({ message: 'Email and password are required.' });
  }

  const normalizedEmail = email.trim().toLowerCase();
  if (!EMAIL_PATTERN.test(normalizedEmail)) {
    return res.status(400).json({ message: 'Enter a valid email address.' });
  }

  try {
    const user = await User.findOne({ email: normalizedEmail }).select('+password');
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ message: 'Invalid email or password.' });
    }

    const token = signAuthToken(user._id);
    return res.status(200).json({ token, user: toSafeUser(user) });
  } catch (error) {
    return next(error);
  }
}

export function getCurrentUser(req, res) {
  return res.status(200).json({ user: toSafeUser(req.user) });
}

export function logout(_req, res) {
  return res.status(200).json({
    message: 'Logout acknowledged. Discard this token; it remains valid until it expires.',
  });
}
