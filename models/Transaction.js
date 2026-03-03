const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['escrow_fund', 'milestone_release', 'refund', 'subscription', 'payout'],
    required: true,
  },
  amount: { type: Number, required: true },
  platformFee: { type: Number, default: 0 },
  netAmount: { type: Number, required: true },
  currency: { type: String, default: 'usd' },

  from: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  to: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  milestone: { type: mongoose.Schema.Types.ObjectId, ref: 'Milestone' },
  contract: { type: mongoose.Schema.Types.ObjectId, ref: 'Contract' },

  // Stripe IDs
  stripePaymentIntentId: { type: String, default: '' },
  stripeTransferId: { type: String, default: '' },
  stripeRefundId: { type: String, default: '' },
  stripeSubscriptionId: { type: String, default: '' },

  status: {
    type: String,
    enum: ['pending', 'completed', 'failed', 'refunded'],
    default: 'pending',
  },
  description: { type: String },
  metadata: { type: Object },
}, { timestamps: true });

transactionSchema.index({ from: 1, createdAt: -1 });
transactionSchema.index({ to: 1, createdAt: -1 });
transactionSchema.index({ type: 1, status: 1 });

module.exports = mongoose.model('Transaction', transactionSchema);
