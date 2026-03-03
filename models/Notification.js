const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  recipient: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  type: {
    type: String,
    enum: [
      'proposal_received', 'proposal_accepted', 'proposal_rejected',
      'contract_started', 'milestone_funded', 'milestone_submitted',
      'milestone_approved', 'payment_released', 'payment_failed',
      'subscription_activated', 'subscription_cancelled', 'payout_sent',
      'dispute_opened', 'dispute_resolved', 'general',
    ],
    required: true,
  },
  title: { type: String, required: true },
  message: { type: String, required: true },
  link: { type: String, default: '' },
  isRead: { type: Boolean, default: false },
  data: { type: Object },
}, { timestamps: true });

notificationSchema.index({ recipient: 1, isRead: 1, createdAt: -1 });

module.exports = mongoose.model('Notification', notificationSchema);
