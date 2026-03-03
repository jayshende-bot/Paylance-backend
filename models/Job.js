const mongoose = require('mongoose');

const jobSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true, maxlength: 200 },
  description: { type: String, required: true, maxlength: 5000 },
  client: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  budget: {
    type: { type: String, enum: ['fixed', 'hourly'], default: 'fixed' },
    min: { type: Number, required: true },
    max: { type: Number, required: true },
    currency: { type: String, default: 'usd' },
  },
  skills: [{ type: String }],
  category: { type: String, required: true },
  duration: { type: String, enum: ['short', 'medium', 'long'], default: 'medium' },
  experienceLevel: { type: String, enum: ['entry', 'intermediate', 'expert'], default: 'intermediate' },
  status: { type: String, enum: ['open', 'in_progress', 'completed', 'cancelled'], default: 'open' },
  proposals: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Proposal' }],
  selectedProposal: { type: mongoose.Schema.Types.ObjectId, ref: 'Proposal' },
  attachments: [{ url: String, name: String }],
  views: { type: Number, default: 0 },
  isUrgent: { type: Boolean, default: false },
}, { timestamps: true });

jobSchema.index({ status: 1, createdAt: -1 });
jobSchema.index({ skills: 1 });
jobSchema.index({ 'budget.min': 1, 'budget.max': 1 });

module.exports = mongoose.model('Job', jobSchema);
