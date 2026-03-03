const User = require('../models/User');
const ApiError = require('../utils/ApiError');
const ApiResponse = require('../utils/ApiResponse');
const stripeService = require('../services/stripeService');

const isDev = process.env.NODE_ENV !== 'production';

// POST /api/v1/connect/onboard
const onboard = async (req, res, next) => {
  try {
    if (req.user.role !== 'freelancer') throw new ApiError(403, 'Only freelancers can onboard');

    // Dev bypass: instantly mark account as verified, redirect back to app
    if (isDev) {
      await User.findByIdAndUpdate(req.user._id, {
        stripeAccountId: `dev_acct_${req.user._id}`,
        stripeAccountVerified: true,
      });
      const returnUrl = `${process.env.CLIENT_URL}/stripe/return?returned=true`;
      return res.json(new ApiResponse(200, { url: returnUrl, devBypass: true },
        '[DEV] Stripe onboarding bypassed. Account marked as verified.'));
    }

    let accountId = req.user.stripeAccountId;

    // Create Connect account if not exists
    if (!accountId) {
      const account = await stripeService.createConnectAccount();
      accountId = account.id;
      await User.findByIdAndUpdate(req.user._id, { stripeAccountId: accountId });
    }

    const accountLink = await stripeService.createAccountLink(
      accountId,
      `${process.env.CLIENT_URL}/stripe/refresh`,
      `${process.env.CLIENT_URL}/stripe/return`
    );

    res.json(new ApiResponse(200, { url: accountLink.url }, 'Onboarding link generated'));
  } catch (err) {
    next(err);
  }
};

// GET /api/v1/connect/status
const getStatus = async (req, res, next) => {
  try {
    // Dev bypass: read verification status directly from DB
    if (isDev) {
      return res.json(new ApiResponse(200, {
        verified: req.user.stripeAccountVerified,
        chargesEnabled: req.user.stripeAccountVerified,
        payoutsEnabled: req.user.stripeAccountVerified,
        accountId: req.user.stripeAccountId || null,
        requirements: { currently_due: [] },
        devBypass: true,
      }));
    }

    if (!req.user.stripeAccountId) {
      return res.json(new ApiResponse(200, { verified: false, accountId: null }));
    }

    const account = await stripeService.retrieveAccount(req.user.stripeAccountId);
    const verified = account.charges_enabled && account.payouts_enabled;

    // Update DB if newly verified
    if (verified && !req.user.stripeAccountVerified) {
      await User.findByIdAndUpdate(req.user._id, { stripeAccountVerified: true });
    }

    res.json(new ApiResponse(200, {
      verified,
      chargesEnabled: account.charges_enabled,
      payoutsEnabled: account.payouts_enabled,
      accountId: req.user.stripeAccountId,
      requirements: account.requirements,
    }));
  } catch (err) {
    next(err);
  }
};

// GET /api/v1/connect/dashboard
const getDashboardLink = async (req, res, next) => {
  try {
    // Dev bypass: return a placeholder URL
    if (isDev) {
      return res.json(new ApiResponse(200, {
        url: 'https://dashboard.stripe.com/test/connect/accounts',
        devBypass: true,
      }, '[DEV] Real Stripe dashboard requires production keys'));
    }

    if (!req.user.stripeAccountId) throw new ApiError(400, 'No Stripe account found');

    const link = await stripeService.createLoginLink(req.user.stripeAccountId);
    res.json(new ApiResponse(200, { url: link.url }));
  } catch (err) {
    next(err);
  }
};

// POST /api/v1/connect/payout
const triggerPayout = async (req, res, next) => {
  try {
    const { amount } = req.body;
    if (!req.user.stripeAccountVerified) throw new ApiError(400, 'Stripe account not verified');
    if (!amount || amount <= 0) throw new ApiError(400, 'Invalid payout amount');

    const payout = await stripeService.createPayout(req.user.stripeAccountId, amount);

    await User.findByIdAndUpdate(req.user._id, {
      $inc: { 'earnings.pending': -amount, 'earnings.withdrawn': amount },
    });

    res.json(new ApiResponse(200, { payout }, 'Payout initiated'));
  } catch (err) {
    next(err);
  }
};

module.exports = { onboard, getStatus, getDashboardLink, triggerPayout };
