import mongoose from 'mongoose';

export const REQUEST_CATEGORIES = [
  'FOOD',
  'GROCERIES',
  'MEDICINE',
  'STATIONERY',
  'TOOLS',
  'OTHER',
];

export const REQUEST_STATUSES = [
  'OPEN',
  'NEGOTIATING',
  'ACCEPTED',
  'IN_PROGRESS',
  'COMPLETED',
  'CANCELLED',
];

const statusHistorySchema = new mongoose.Schema(
  {
    status: {
      type: String,
      enum: REQUEST_STATUSES,
      required: true,
    },
    changedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    changedAt: {
      type: Date,
      required: true,
      default: Date.now,
    },
  },
  { _id: false },
);

const requestSchema = new mongoose.Schema(
  {
    requester: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    item: {
      type: String,
      required: true,
      trim: true,
    },
    category: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      enum: REQUEST_CATEGORIES,
    },
    quantity: {
      type: Number,
      required: true,
      min: 1,
    },
    reward: {
      type: Number,
      required: true,
      min: 0,
    },
    location: {
      type: String,
      required: true,
      trim: true,
    },
    requiredTime: {
      type: Date,
      required: true,
    },
    instructions: String,
    status: {
      type: String,
      enum: REQUEST_STATUSES,
      default: 'OPEN',
    },
    acceptedOffer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Offer',
      default: null,
    },
    acceptedPrice: {
      type: Number,
      min: 0,
      default: null,
    },
    statusHistory: {
      type: [statusHistorySchema],
      default: [],
    },
    completedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true },
);

requestSchema.index({ status: 1, requiredTime: 1 });
requestSchema.index({ status: 1, category: 1, requiredTime: 1, createdAt: -1 });
requestSchema.index({ requester: 1, status: 1 });

const Request = mongoose.models.Request || mongoose.model('Request', requestSchema);

export default Request;
