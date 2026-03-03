const User = require('../models/User');
const Subscription = require('../models/Subscription');
const ApiError = require('../utils/ApiError');
const ApiResponse = require('../utils/ApiResponse');
const stripeService = require('../services/stripeService');
const emailService = require('../services/emailService');

// POST /api/v1/subscriptions/create
const createSubscription = async (req, res, next) => {
  try {
    if (req.user.role !== 'freelancer') throw new ApiError(403, 'Only freelancers can subscribe');
    if (req.user.subscriptionStatus === 'pro') throw new ApiError(400, 'Already subscribed to Pro');

    const subscription = await stripeService.createSubscription(
      req.user.stripeCustomerId,
      process.env.STRIPE_PRO_PRICE_ID
    );

    const latestInvoice = subscription.latest_invoice;
    const paymentIntent = latestInvoice?.payment_intent;

    await Subscription.create({
      user: req.user._id,
      stripeSubscriptionId: subscription.id,
      stripeCustomerId: req.user.stripeCustomerId,
      stripePriceId: process.env.STRIPE_PRO_PRICE_ID,
      plan: 'pro',
      status: subscription.status,
      currentPeriodStart: new Date(subscription.current_period_start * 1000),
      currentPeriodEnd: new Date(subscription.current_period_end * 1000),
    });

    res.json(new ApiResponse(201, {
      subscriptionId: subscription.id,
      clientSecret: paymentIntent?.client_secret,
      status: subscription.status,
    }, 'Subscription created'));
  } catch (err) {
    next(err);
  }
};

// DELETE /api/v1/subscriptions/cancel
const cancelSubscription = async (req, res, next) => {
  try {
    const sub = await Subscription.findOne({ user: req.user._id, status: 'active' });
    if (!sub) throw new ApiError(404, 'No active subscription found');

    await stripeService.cancelSubscription(sub.stripeSubscriptionId);

    sub.status = 'cancelled';
    sub.cancelAtPeriodEnd = true;
    await sub.save();

    await User.findByIdAndUpdate(req.user._id, { subscriptionStatus: 'free', subscriptionId: '' });

    res.json(new ApiResponse(200, null, 'Subscription cancelled'));
  } catch (err) {
    next(err);
  }
};

// GET /api/v1/subscriptions/status
const getStatus = async (req, res, next) => {
  try {
    const sub = await Subscription.findOne({ user: req.user._id }).sort({ createdAt: -1 });
    res.json(new ApiResponse(200, {
      plan: req.user.subscriptionStatus,
      subscription: sub,
    }));
  } catch (err) {
    next(err);
  }
};

module.exports = { createSubscription, cancelSubscription, getStatus };
