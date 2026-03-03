const nodemailer = require('nodemailer');
const logger = require('../utils/logger');

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT) || 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

const send = async ({ to, subject, html }) => {
  try {
    await transporter.sendMail({
      from: process.env.SMTP_FROM || 'PayLance <noreply@paylance.com>',
      to,
      subject,
      html,
    });
    logger.info(`Email sent to ${to}: ${subject}`);
  } catch (err) {
    logger.error(`Email failed to ${to}: ${err.message}`);
  }
};

// ── Templates ─────────────────────────────────────────────────────────────────
const sendWelcome = (user) =>
  send({
    to: user.email,
    subject: 'Welcome to PayLance!',
    html: `<h2>Welcome, ${user.name}!</h2>
    <p>Your account has been created as a <strong>${user.role}</strong>.</p>
    <p>Start exploring PayLance and find great opportunities.</p>`,
  });

const sendMilestoneFunded = (freelancer, milestone, contract) =>
  send({
    to: freelancer.email,
    subject: `Milestone Funded: ${milestone.title}`,
    html: `<h2>Payment Secured in Escrow</h2>
    <p>The client has funded <strong>$${milestone.amount}</strong> for milestone "<strong>${milestone.title}</strong>".</p>
    <p>Complete your work and submit for approval to receive your payment.</p>`,
  });

const sendMilestoneApproved = (freelancer, milestone) =>
  send({
    to: freelancer.email,
    subject: `Payment Released: ${milestone.title}`,
    html: `<h2>Payment Released!</h2>
    <p>Your payment of <strong>$${(milestone.amount * 0.9).toFixed(2)}</strong> has been released for "<strong>${milestone.title}</strong>".</p>
    <p>It should appear in your bank account within 2-3 business days.</p>`,
  });

const sendProposalReceived = (client, freelancer, job) =>
  send({
    to: client.email,
    subject: `New Proposal on: ${job.title}`,
    html: `<h2>New Proposal Received</h2>
    <p><strong>${freelancer.name}</strong> has submitted a proposal for your job "<strong>${job.title}</strong>".</p>
    <p>Login to review and accept the proposal.</p>`,
  });

const sendContractStarted = (user, contract) =>
  send({
    to: user.email,
    subject: `Contract Started: ${contract.title}`,
    html: `<h2>Contract is now Active</h2>
    <p>Your contract "<strong>${contract.title}</strong>" has been activated.</p>`,
  });

const sendPaymentFailed = (user, amount) =>
  send({
    to: user.email,
    subject: 'Payment Failed - Action Required',
    html: `<h2>Payment Failed</h2>
    <p>Your payment of <strong>$${amount}</strong> has failed.</p>
    <p>Please update your payment method and try again.</p>`,
  });

const sendSubscriptionReceipt = (user, plan, amount) =>
  send({
    to: user.email,
    subject: 'PayLance Pro - Payment Confirmed',
    html: `<h2>Subscription Activated</h2>
    <p>Your <strong>${plan}</strong> subscription is now active. Amount charged: <strong>$${amount}</strong>.</p>`,
  });

module.exports = {
  sendWelcome,
  sendMilestoneFunded,
  sendMilestoneApproved,
  sendProposalReceived,
  sendContractStarted,
  sendPaymentFailed,
  sendSubscriptionReceipt,
};
