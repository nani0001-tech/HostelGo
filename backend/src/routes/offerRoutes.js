import { Router } from 'express';
import {
  acceptOffer,
  counterOffer,
  getMyOffers,
  rejectOffer,
} from '../controllers/offerController.js';
import authMiddleware from '../middleware/authMiddleware.js';

const router = Router();

router.get('/my', authMiddleware, getMyOffers);
router.put('/:offerId/accept', authMiddleware, acceptOffer);
router.put('/:offerId/reject', authMiddleware, rejectOffer);
router.post('/:offerId/counter', authMiddleware, counterOffer);

export default router;
