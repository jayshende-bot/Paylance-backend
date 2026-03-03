const stripe = require('../config/stripe');

const PLATFORM_FEE_PERCENT = Number(process.env.STRIPE_PLATFORM_FEE_PERCENT || 10);

// ── Customer ──────────────────────────────────────────────────────────────────
const createCustomer = (email, name, userId) =>
  stripe.customers.create({ email, name, metadata: { userId } });

// ── Connect (Freelancer onboarding) ──────────────────────────────────────────
const createConnectAccount = () =>
  stripe.accounts.create({ type: 'express' });

const createAccountLink = (accountId, refreshUrl, returnUrl) =>
  stripe.accountLinks.create({
    account: accountId,
    refresh_url: refreshUrl,
    return_url: returnUrl,
    type: 'account_onboarding',
  });

const retrieveAccount = (accountId) =>
  stripe.accounts.retrieve(accountId);

const createLoginLink = (accountId) =>
  stripe.accounts.createLoginLink(accountId);

// ── Escrow / PaymentIntent ─────────────────────────────────────────────────
/**
 * Create a PaymentIntent with manual capture = escrow.
 * Funds are authorized but NOT captured until releaseMilestone is called.
 */
const createEscrowPaymentIntent = async ({
  amountUSD,
  currency = 'usd',
  customerId,
  milestoneId,
  contractId,
}) => {
  const amountCents = Math.round(amountUSD * 100);

  return stripe.paymentIntents.create({
    amount: amountCents,
    currency,
    customer: customerId,
    capture_method: 'manual',           // KEY: holds funds without capturing
    setup_future_usage: 'off_session',
    metadata: { milestoneId, contractId },
    description: `Escrow for milestone ${milestoneId}`,
  });
};

const confirmPaymentIntent = (paymentIntentId) =>
  stripe.paymentIntents.confirm(paymentIntentId);

/**
 * Capture the held funds and transfer 90% to the freelancer.
 * Platform automatically keeps the commission.
 */
const releaseMilestonePayment = async ({
  paymentIntentId,
  freelancerAccountId,
  amountUSD,
  contractId,
}) => {
  const totalCents = Math.round(amountUSD * 100);
  const freelancerCents = Math.round(totalCents * (1 - PLATFORM_FEE_PERCENT / 100));

  // 1. Capture the held funds
  await stripe.paymentIntents.capture(paymentIntentId);

  // 2. Transfer freelancer's share to their connected account
  const transfer = await stripe.transfers.create({
    amount: freelancerCents,
    currency: 'usd',
    destination: freelancerAccountId,
    transfer_group: contractId,
    metadata: { paymentIntentId, contractId },
  });

  return { transfer, platformFeeUSD: amountUSD * (PLATFORM_FEE_PERCENT / 100) };
};

const refundPaymentIntent = (paymentIntentId, reason = 'requested_by_customer') =>
  stripe.refunds.create({ payment_intent: paymentIntentId, reason });

const cancelPaymentIntent = (paymentIntentId) =>
  stripe.paymentIntents.cancel(paymentIntentId);

const retrievePaymentIntent = (paymentIntentId) =>
  stripe.paymentIntents.retrieve(paymentIntentId);

// ── Subscriptions ─────────────────────────────────────────────────────────────
const createSubscription = async (customerId, priceId) => {
  return stripe.subscriptions.create({
    customer: customerId,
    items: [{ price: priceId }],
    payment_behavior: 'default_incomplete',
    payment_settings: { save_default_payment_method: 'on_subscription' },
    expand: ['latest_invoice.payment_intent'],
  });
};

const cancelSubscription = (subscriptionId) =>
  stripe.subscriptions.cancel(subscriptionId);

const retrieveSubscription = (subscriptionId) =>
  stripe.subscriptions.retrieve(subscriptionId);

// ── Payouts ───────────────────────────────────────────────────────────────────
const createPayout = (accountId, amountUSD, currency = 'usd') =>
  stripe.payouts.create(
    { amount: Math.round(amountUSD * 100), currency },
    { stripeAccount: accountId }
  );

// ── Webhooks ──────────────────────────────────────────────────────────────────
const constructWebhookEvent = (rawBody, signature, secret) =>
  stripe.webhooks.constructEvent(rawBody, signature, secret);

module.exports = {
  createCustomer,
  createConnectAccount,
  createAccountLink,
  retrieveAccount,
  createLoginLink,
  createEscrowPaymentIntent,
  confirmPaymentIntent,
  releaseMilestonePayment,
  refundPaymentIntent,
  cancelPaymentIntent,
  retrievePaymentIntent,
  createSubscription,
  cancelSubscription,
  retrieveSubscription,
  createPayout,
  constructWebhookEvent,
  PLATFORM_FEE_PERCENT,
};
