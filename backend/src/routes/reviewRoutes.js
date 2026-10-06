import { Router } from 'express';
import {
  canReviewRequest,
  createReview,
  getMyReviews,
} from '../controllers/reviewController.js';
import authMiddleware from '../middleware/authMiddleware.js';

const router = Router();

router.post('/', authMiddleware, createReview);
router.get('/my', authMiddleware, getMyReviews);
router.get('/can-review/:requestId', authMiddleware, canReviewRequest);

export default router;
