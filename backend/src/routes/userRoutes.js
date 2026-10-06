import { Router } from 'express';
import { getUserReviews } from '../controllers/reviewController.js';

const router = Router();

router.get('/:userId/reviews', getUserReviews);

export default router;
