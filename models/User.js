const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 100 },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, required: true, minlength: 8, select: false },
  role: { type: String, enum: ['client', 'freelancer', 'admin'], required: true },
  avatar: { type: String, default: '' },
  bio: { type: String, maxlength: 500, default: '' },
  skills: [{ type: String }],
  hourlyRate: { type: Number, default: 0 },
  location: { type: String, default: '' },

  // Stripe fields
  stripeCustomerId: { type: String, default: '' },
  stripeAccountId: { type: String, default: '' },       // Freelancers only
  stripeAccountVerified: { type: Boolean, default: false },

  // Subscription
  subscriptionStatus: { type: String, enum: ['free', 'pro'], default: 'free' },
  subscriptionId: { type: String, default: '' },

  // Earnings (freelancers)
  earnings: {
    total: { type: Number, default: 0 },
    pending: { type: Number, default: 0 },
    withdrawn: { type: Number, default: 0 },
  },

  isActive: { type: Boolean, default: true },
  lastLogin: { type: Date },
}, { timestamps: true });

// Hash password before save
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

userSchema.methods.matchPassword = async function (entered) {
  return bcrypt.compare(entered, this.password);
};

userSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.password;
  return obj;
};

module.exports = mongoose.model('User', userSchema);
