import cors from 'cors';
import express from 'express';
import authRoutes from './routes/authRoutes.js';
import healthRoutes from './routes/health.routes.js';
import notificationRoutes from './routes/notificationRoutes.js';
import offerRoutes from './routes/offerRoutes.js';
import requestRoutes from './routes/requestRoutes.js';
import reviewRoutes from './routes/reviewRoutes.js';
import userRoutes from './routes/userRoutes.js';

const app = express();

app.use(cors({ origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173' }));
app.use(express.json());
app.use('/api/health', healthRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/requests', requestRoutes);
app.use('/api/offers', offerRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/users', userRoutes);

app.use((error, _req, res, next) => {
  if (res.headersSent) {
    return next(error);
  }

  if (error instanceof SyntaxError && error.status === 400 && 'body' in error) {
    return res.status(400).json({ message: 'Request body must contain valid JSON.' });
  }

  console.error('Unhandled API error:', error.name || 'Error');
  return res.status(500).json({ message: 'Internal server error.' });
});

export default app;
