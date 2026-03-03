const Milestone = require('../models/Milestone');
const Contract = require('../models/Contract');
const ApiError = require('../utils/ApiError');
const ApiResponse = require('../utils/ApiResponse');
const notificationService = require('../services/notificationService');

// POST /api/v1/milestones
const createMilestone = async (req, res, next) => {
  try {
    const { contractId, title, description, amount, dueDate, order } = req.body;

    const contract = await Contract.findById(contractId);
    if (!contract) throw new ApiError(404, 'Contract not found');
    if (contract.client.toString() !== req.user._id.toString()) {
      throw new ApiError(403, 'Only the client can create milestones');
    }

    const milestone = await Milestone.create({ contract: contractId, title, description, amount, dueDate, order });
    await Contract.findByIdAndUpdate(contractId, { $push: { milestones: milestone._id } });

    res.status(201).json(new ApiResponse(201, { milestone }, 'Milestone created'));
  } catch (err) {
    next(err);
  }
};

// GET /api/v1/milestones/contract/:contractId
const getContractMilestones = async (req, res, next) => {
  try {
    const contract = await Contract.findById(req.params.contractId);
    if (!contract) throw new ApiError(404, 'Contract not found');

    const isParty = [contract.client.toString(), contract.freelancer.toString()]
      .includes(req.user._id.toString());
    if (!isParty && req.user.role !== 'admin') throw new ApiError(403, 'Unauthorized');

    const milestones = await Milestone.find({ contract: req.params.contractId }).sort({ order: 1 });
    res.json(new ApiResponse(200, { milestones }));
  } catch (err) {
    next(err);
  }
};

// POST /api/v1/milestones/:id/submit
const submitMilestone = async (req, res, next) => {
  try {
    const { note, attachments } = req.body;
    const milestone = await Milestone.findById(req.params.id).populate('contract');
    if (!milestone) throw new ApiError(404, 'Milestone not found');

    if (milestone.contract.freelancer.toString() !== req.user._id.toString()) {
      throw new ApiError(403, 'Only the freelancer can submit work');
    }
    if (milestone.status !== 'funded') throw new ApiError(400, 'Milestone must be funded before submission');

    milestone.submissions.push({ note, attachments: attachments || [] });
    milestone.status = 'submitted';
    await milestone.save();

    notificationService.notifyMilestoneSubmitted(
      milestone.contract.client,
      milestone,
      milestone.contract._id
    ).catch(() => {});

    res.json(new ApiResponse(200, { milestone }, 'Work submitted successfully'));
  } catch (err) {
    next(err);
  }
};

// PATCH /api/v1/milestones/:id/dispute
const disputeMilestone = async (req, res, next) => {
  try {
    const milestone = await Milestone.findById(req.params.id).populate('contract');
    if (!milestone) throw new ApiError(404, 'Milestone not found');

    const contract = milestone.contract;
    const isParty = [contract.client.toString(), contract.freelancer.toString()]
      .includes(req.user._id.toString());
    if (!isParty) throw new ApiError(403, 'Unauthorized');

    milestone.status = 'disputed';
    await milestone.save();

    await Contract.findByIdAndUpdate(contract._id, { status: 'disputed' });

    res.json(new ApiResponse(200, { milestone }, 'Dispute opened. Admin will review.'));
  } catch (err) {
    next(err);
  }
};

module.exports = { createMilestone, getContractMilestones, submitMilestone, disputeMilestone };
