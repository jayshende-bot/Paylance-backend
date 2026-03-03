const Milestone = require('../models/Milestone');
const Contract = require('../models/Contract');
const Transaction = require('../models/Transaction');
const User = require('../models/User');
const ApiError = require('../utils/ApiError');
const ApiResponse = require('../utils/ApiResponse');
const stripeService = require('../services/stripeService');
const notificationService = require('../services/notificationService');
const emailService = require('../services/emailService');

// POST /api/v1/payment/fund-escrow
// Creates a PaymentIntent (manual capture) to hold funds for a milestone
const fundEscrow = async (req, res, next) => {
  try {
    const { milestoneId } = req.body;

    const milestone = await Milestone.findById(milestoneId).populate({
      path: 'contract',
      populate: { path: 'freelancer', select: 'name stripeAccountId stripeAccountVerified' },
    });

    if (!milestone) throw new ApiError(404, 'Milestone not found');
    if (milestone.status !== 'pending') throw new ApiError(400, 'Milestone already funded or not in pending state');

    const contract = milestone.contract;
    if (contract.client.toString() !== req.user._id.toString()) {
      throw new ApiError(403, 'Only the client can fund this milestone');
    }

    const isDev = process.env.NODE_ENV !== 'production';
    if (!isDev && !contract.freelancer.stripeAccountVerified) {
      throw new ApiError(400, 'Freelancer has not completed Stripe onboarding');
    }

    // Dev bypass: skip Stripe entirely, mark milestone as funded immediately
    if (isDev) {
      milestone.status = 'funded';
      milestone.paymentIntentId = `dev_pi_${Date.now()}`;
      milestone.fundedAt = new Date();
      await milestone.save();
      return res.json(new ApiResponse(200, {
        devBypass: true,
        amount: milestone.amount,
      }, '[DEV] Milestone funded without Stripe. Restart backend in production mode to use real payments.'));
    }

    const paymentIntent = await stripeService.createEscrowPaymentIntent({
      amountUSD: milestone.amount,
      currency: milestone.currency,
      customerId: req.user.stripeCustomerId,
      milestoneId: milestone._id.toString(),
      contractId: contract._id.toString(),
    });

    // Save the PaymentIntent ID to the milestone
    milestone.paymentIntentId = paymentIntent.id;
    await milestone.save();

    res.json(new ApiResponse(200, {
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
      amount: milestone.amount,
    }, 'Payment Intent created. Complete payment on frontend.'));
  } catch (err) {
    next(err);
  }
};

// POST /api/v1/payment/release/:milestoneId
// Capture the held funds + transfer to freelancer
const releaseMilestone = async (req, res, next) => {
  try {
    const milestone = await Milestone.findById(req.params.milestoneId).populate({
      path: 'contract',
      populate: [
        { path: 'client', select: 'name email' },
        { path: 'freelancer', select: 'name email stripeAccountId earnings' },
      ],
    });

    if (!milestone) throw new ApiError(404, 'Milestone not found');
    if (milestone.status !== 'funded' && milestone.status !== 'submitted') {
      throw new ApiError(400, 'Milestone must be funded/submitted before release');
    }

    const contract = milestone.contract;
    if (contract.client._id.toString() !== req.user._id.toString()) {
      throw new ApiError(403, 'Only the client can approve milestone release');
    }

    const isDev = process.env.NODE_ENV !== 'production';
    let transferId = 'dev_transfer_bypass';
    let platformFeeUSD = milestone.amount * 0.1;

    if (!isDev) {
      // Release: capture + transfer (production only — requires real Stripe Connect account)
      const result = await stripeService.releaseMilestonePayment({
        paymentIntentId: milestone.paymentIntentId,
        freelancerAccountId: contract.freelancer.stripeAccountId,
        amountUSD: milestone.amount,
        contractId: contract._id.toString(),
      });
      transferId = result.transfer.id;
      platformFeeUSD = result.platformFeeUSD;
    }

    const netAmount = milestone.amount - platformFeeUSD;

    // Update milestone
    milestone.status = 'released';
    milestone.transferId = transferId;
    milestone.releasedAt = new Date();
    await milestone.save();

    // Record transaction
    await Transaction.create({
      type: 'milestone_release',
      amount: milestone.amount,
      platformFee: platformFeeUSD,
      netAmount,
      currency: milestone.currency,
      from: contract.client._id,
      to: contract.freelancer._id,
      milestone: milestone._id,
      contract: contract._id,
      stripePaymentIntentId: milestone.paymentIntentId,
      stripeTransferId: transferId,
      status: 'completed',
      description: `Milestone release: ${milestone.title}`,
    });

    // Update freelancer earnings
    await User.findByIdAndUpdate(contract.freelancer._id, {
      $inc: { 'earnings.total': netAmount, 'earnings.pending': netAmount },
    });

    // Notify + email
    notificationService.notifyPaymentReleased(contract.freelancer._id, milestone, contract._id).catch(() => {});
    emailService.sendMilestoneApproved(contract.freelancer, milestone).catch(() => {});

    res.json(new ApiResponse(200, {
      milestoneId: milestone._id,
      amount: milestone.amount,
      freelancerReceives: netAmount,
      platformFee: platformFeeUSD,
    }, 'Milestone approved. Payment released to freelancer.'));
  } catch (err) {
    next(err);
  }
};

// POST /api/v1/payment/refund/:milestoneId
const refundMilestone = async (req, res, next) => {
  try {
    const milestone = await Milestone.findById(req.params.milestoneId).populate('contract');
    if (!milestone) throw new ApiError(404, 'Milestone not found');
    if (!['funded', 'disputed'].includes(milestone.status)) {
      throw new ApiError(400, 'Milestone cannot be refunded in its current state');
    }

    if (milestone.contract.client.toString() !== req.user._id.toString()) {
      throw new ApiError(403, 'Unauthorized');
    }

    const refund = await stripeService.refundPaymentIntent(milestone.paymentIntentId);

    milestone.status = 'refunded';
    milestone.refundId = refund.id;
    await milestone.save();

    await Transaction.create({
      type: 'refund',
      amount: milestone.amount,
      netAmount: milestone.amount,
      currency: milestone.currency,
      from: milestone.contract.freelancer,
      to: milestone.contract.client,
      milestone: milestone._id,
      stripeRefundId: refund.id,
      status: 'completed',
    });

    res.json(new ApiResponse(200, { refundId: refund.id }, 'Refund initiated successfully'));
  } catch (err) {
    next(err);
  }
};

// GET /api/v1/payment/history
const getHistory = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, type } = req.query;
    const filter = {
      $or: [{ from: req.user._id }, { to: req.user._id }],
    };
    if (type) filter.type = type;

    const [transactions, total] = await Promise.all([
      Transaction.find(filter)
        .populate('from', 'name avatar')
        .populate('to', 'name avatar')
        .populate('milestone', 'title')
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(Number(limit)),
      Transaction.countDocuments(filter),
    ]);

    res.json(new ApiResponse(200, { transactions, total, page: Number(page) }));
  } catch (err) {
    next(err);
  }
};

module.exports = { fundEscrow, releaseMilestone, refundMilestone, getHistory };
