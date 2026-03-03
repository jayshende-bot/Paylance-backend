const mongoose = require('mongoose');

const subscriptionSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  stripeSubscriptionId: { type: String, required: true },
  stripeCustomerId: { type: String, required: true },
  stripePriceId: { type: String, required: true },
  plan: { type: String, enum: ['pro'], required: true },
  status: {
    type: String,
    enum: ['active', 'cancelled', 'past_due', 'incomplete', 'trialing'],
    default: 'incomplete',
  },
  currentPeriodStart: { type: Date },
  currentPeriodEnd: { type: Date },
  cancelAtPeriodEnd: { type: Boolean, default: false },
}, { timestamps: true });

module.exports = mongoose.model('Subscription', subscriptionSchema);
