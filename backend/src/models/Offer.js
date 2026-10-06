import mongoose from 'mongoose';

export const OFFER_STATUSES = ['PENDING', 'ACCEPTED', 'REJECTED', 'COUNTERED'];

const offerSchema = new mongoose.Schema(
  {
    request: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Request',
      required: true,
    },
    helper: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    previousOffer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Offer',
    },
    proposedPrice: {
      type: Number,
      required: true,
      min: 0,
    },
    message: String,
    status: {
      type: String,
      enum: OFFER_STATUSES,
      default: 'PENDING',
    },
  },
  { timestamps: true },
);

offerSchema.index({ request: 1, status: 1 });
offerSchema.index({ helper: 1, status: 1 });
offerSchema.index({ createdBy: 1, createdAt: -1 });
offerSchema.index({ previousOffer: 1 }, { unique: true, sparse: true });

const Offer = mongoose.models.Offer || mongoose.model('Offer', offerSchema);

export default Offer;
