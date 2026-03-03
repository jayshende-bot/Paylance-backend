const mongoose = require('mongoose');

const milestoneSchema = new mongoose.Schema({
  contract: { type: mongoose.Schema.Types.ObjectId, ref: 'Contract', required: true },
  title: { type: String, required: true },
  description: { type: String, maxlength: 1000 },
  amount: { type: Number, required: true },
  currency: { type: String, default: 'usd' },
  status: {
    type: String,
    enum: ['pending', 'funded', 'submitted', 'approved', 'released', 'disputed', 'refunded'],
    default: 'pending',
  },
  dueDate: { type: Date },
  order: { type: Number, default: 0 },

  // Stripe
  paymentIntentId: { type: String, default: '' },
  transferId: { type: String, default: '' },
  refundId: { type: String, default: '' },

  // Submissions by freelancer
  submissions: [{
    note: String,
    attachments: [{ url: String, name: String }],
    submittedAt: { type: Date, default: Date.now },
  }],

  fundedAt: { type: Date },
  releasedAt: { type: Date },
}, { timestamps: true });

module.exports = mongoose.model('Milestone', milestoneSchema);
