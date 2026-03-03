const stripeService = require('../services/stripeService');
const Milestone = require('../models/Milestone');
const User = require('../models/User');
const Subscription = require('../models/Subscription');
const Transaction = require('../models/Transaction');
const notificationService = require('../services/notificationService');
const emailService = require('../services/emailService');
const logger = require('../utils/logger');

/**
 * POST /api/v1/webhook
 * IMPORTANT: This route must use raw body (express.raw), not express.json()
 * Raw body is needed for Stripe signature verification.
 */
const handleWebhook = async (req, res) => {
  const sig = req.headers['stripe-signature'];

  let event;
  try {
    event = stripeService.constructWebhookEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    logger.error(`Webhook signature verification failed: ${err.message}`);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  logger.info(`Stripe webhook received: ${event.type}`);

  try {
    switch (event.type) {

      case 'payment_intent.succeeded': {
        const pi = event.data.object;
        const milestoneId = pi.metadata?.milestoneId;
        if (milestoneId) {
          const milestone = await Milestone.findById(milestoneId).populate('contract');
          if (milestone && milestone.status === 'pending') {
            milestone.status = 'funded';
            milestone.fundedAt = new Date();
            await milestone.save();

            // Record transaction
            await Transaction.create({
              type: 'escrow_fund',
              amount: pi.amount / 100,
              netAmount: pi.amount / 100,
              currency: pi.currency,
              from: milestone.contract.client,
              to: milestone.contract.freelancer,
              milestone: milestone._id,
              contract: milestone.contract._id,
              stripePaymentIntentId: pi.id,
              status: 'completed',
              description: `Escrow funded: ${milestone.title}`,
            });

            notificationService.notifyMilestoneFunded(
              milestone.contract.freelancer,
              milestone,
              milestone.contract._id
            ).catch(() => {});

            const freelancer = await User.findById(milestone.contract.freelancer).select('email name');
            if (freelancer) {
              emailService.sendMilestoneFunded(freelancer, milestone, milestone.contract).catch(() => {});
            }
          }
        }
        break;
      }

      case 'payment_intent.payment_failed': {
        const pi = event.data.object;
        const milestoneId = pi.metadata?.milestoneId;
        if (milestoneId) {
          const milestone = await Milestone.findById(milestoneId).populate('contract');
          if (milestone) {
            milestone.status = 'pending';
            await milestone.save();

            const client = await User.findById(milestone.contract.client).select('email name');
            if (client) {
              emailService.sendPaymentFailed(client, pi.amount / 100).catch(() => {});
            }
          }
        }
        break;
      }

      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const sub = event.data.object;
        await Subscription.findOneAndUpdate(
          { stripeSubscriptionId: sub.id },
          {
            status: sub.status,
            currentPeriodStart: new Date(sub.current_period_start * 1000),
            currentPeriodEnd: new Date(sub.current_period_end * 1000),
            cancelAtPeriodEnd: sub.cancel_at_period_end,
          }
        );

        if (sub.status === 'active') {
          const dbSub = await Subscription.findOne({ stripeSubscriptionId: sub.id });
          if (dbSub) {
            await User.findByIdAndUpdate(dbSub.user, {
              subscriptionStatus: 'pro',
              subscriptionId: sub.id,
            });
          }
        }
        break;
      }

      case 'customer.subscription.deleted': {
        const sub = event.data.object;
        await Subscription.findOneAndUpdate(
          { stripeSubscriptionId: sub.id },
          { status: 'cancelled' }
        );
        const dbSub = await Subscription.findOne({ stripeSubscriptionId: sub.id });
        if (dbSub) {
          await User.findByIdAndUpdate(dbSub.user, { subscriptionStatus: 'free', subscriptionId: '' });
        }
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object;
        const customer = await User.findOne({ stripeCustomerId: invoice.customer }).select('email name');
        if (customer) {
          emailService.sendPaymentFailed(customer, invoice.amount_due / 100).catch(() => {});
        }
        break;
      }

      case 'account.updated': {
        const account = event.data.object;
        if (account.charges_enabled && account.payouts_enabled) {
          await User.findOneAndUpdate(
            { stripeAccountId: account.id },
            { stripeAccountVerified: true }
          );
        }
        break;
      }

      default:
        logger.debug(`Unhandled webhook event: ${event.type}`);
    }
  } catch (err) {
    logger.error(`Webhook handler error for ${event.type}: ${err.message}`);
  }

  // Always return 200 to Stripe to acknowledge receipt
  res.json({ received: true });
};

module.exports = { handleWebhook };
