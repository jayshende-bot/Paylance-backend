const mongoose = require('mongoose');

const contractSchema = new mongoose.Schema({
  job: { type: mongoose.Schema.Types.ObjectId, ref: 'Job', required: true },
  proposal: { type: mongoose.Schema.Types.ObjectId, ref: 'Proposal', required: true },
  client: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  freelancer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  title: { type: String, required: true },
  totalAmount: { type: Number, required: true },
  currency: { type: String, default: 'usd' },
  status: {
    type: String,
    enum: ['active', 'completed', 'cancelled', 'disputed'],
    default: 'active',
  },
  milestones: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Milestone' }],
  startDate: { type: Date, default: Date.now },
  endDate: { type: Date },
  transferGroup: { type: String }, // Stripe transfer group
}, { timestamps: true });

module.exports = mongoose.model('Contract', contractSchema);
