const Notification = require('../models/Notification');
let io;

const init = (socketIo) => { io = socketIo; };

const create = async ({ recipient, type, title, message, link = '', data = {} }) => {
  const notification = await Notification.create({ recipient, type, title, message, link, data });

  // Emit real-time via Socket.io
  if (io) {
    io.to(recipient.toString()).emit('notification:new', {
      id: notification._id,
      type,
      title,
      message,
      link,
      data,
      createdAt: notification.createdAt,
    });
  }

  return notification;
};

const notifyMilestoneFunded = (freelancerId, milestone, contractId) =>
  create({
    recipient: freelancerId,
    type: 'milestone_funded',
    title: 'Milestone Funded',
    message: `$${milestone.amount} has been secured in escrow for "${milestone.title}"`,
    link: `/contracts/${contractId}`,
    data: { milestoneId: milestone._id, amount: milestone.amount },
  });

const notifyMilestoneSubmitted = (clientId, milestone, contractId) =>
  create({
    recipient: clientId,
    type: 'milestone_submitted',
    title: 'Work Submitted',
    message: `Freelancer submitted work for "${milestone.title}". Please review and approve.`,
    link: `/contracts/${contractId}`,
    data: { milestoneId: milestone._id },
  });

const notifyPaymentReleased = (freelancerId, milestone, contractId) =>
  create({
    recipient: freelancerId,
    type: 'payment_released',
    title: 'Payment Released!',
    message: `$${(milestone.amount * 0.9).toFixed(2)} has been sent to your bank account.`,
    link: `/earnings`,
    data: { milestoneId: milestone._id, amount: milestone.amount * 0.9 },
  });

const notifyProposalReceived = (clientId, freelancerName, jobId) =>
  create({
    recipient: clientId,
    type: 'proposal_received',
    title: 'New Proposal',
    message: `${freelancerName} submitted a proposal on your job`,
    link: `/jobs/${jobId}`,
    data: { jobId },
  });

const notifyProposalAccepted = (freelancerId, jobTitle, contractId) =>
  create({
    recipient: freelancerId,
    type: 'proposal_accepted',
    title: 'Proposal Accepted!',
    message: `Your proposal was accepted for "${jobTitle}". Contract is now active.`,
    link: `/contracts/${contractId}`,
    data: { contractId },
  });

module.exports = {
  init,
  create,
  notifyMilestoneFunded,
  notifyMilestoneSubmitted,
  notifyPaymentReleased,
  notifyProposalReceived,
  notifyProposalAccepted,
};
