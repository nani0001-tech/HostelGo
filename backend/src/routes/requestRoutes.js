import { Router } from 'express';
import {
  cancelRequest,
  createRequest,
  getMyRequests,
  getOpenRequests,
  getRequestById,
  updateRequest,
} from '../controllers/requestController.js';
import { createOffer, listRequestOffers } from '../controllers/offerController.js';
import { completeRequest, startFulfillment } from '../controllers/fulfillmentController.js';
import authMiddleware from '../middleware/authMiddleware.js';

const router = Router();

router.post('/', authMiddleware, createRequest);
router.post('/:requestId/offers', authMiddleware, createOffer);
router.get('/', getOpenRequests);
router.get('/:requestId/offers', authMiddleware, listRequestOffers);
router.put('/:id/start', authMiddleware, startFulfillment);
router.put('/:id/complete', authMiddleware, completeRequest);
router.get('/my', authMiddleware, getMyRequests);
router.get('/:id', getRequestById);
router.put('/:id', authMiddleware, updateRequest);
router.put('/:id/cancel', authMiddleware, cancelRequest);

export default router;
