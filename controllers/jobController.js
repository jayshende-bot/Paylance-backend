const Job = require('../models/Job');
const Proposal = require('../models/Proposal');
const Contract = require('../models/Contract');
const Milestone = require('../models/Milestone');
const ApiError = require('../utils/ApiError');
const ApiResponse = require('../utils/ApiResponse');
const notificationService = require('../services/notificationService');
const emailService = require('../services/emailService');
const cache = require('../services/cacheService');

// GET /api/v1/jobs
const getJobs = async (req, res, next) => {
  try {
    const { page = 1, limit = 10, category, skills, minBudget, maxBudget, duration, search } = req.query;

    const filter = { status: 'open' };
    if (category) filter.category = category;
    if (skills) filter.skills = { $in: skills.split(',') };
    if (duration) filter.duration = duration;
    if (minBudget || maxBudget) {
      filter['budget.min'] = {};
      if (minBudget) filter['budget.min'].$gte = Number(minBudget);
      if (maxBudget) filter['budget.max'] = { $lte: Number(maxBudget) };
    }
    if (search) filter.$text = { $search: search };

    const skip = (Number(page) - 1) * Number(limit);
    const [jobs, total] = await Promise.all([
      Job.find(filter)
        .populate('client', 'name avatar location')
        .sort({ isUrgent: -1, createdAt: -1 })
        .skip(skip)
        .limit(Number(limit)),
      Job.countDocuments(filter),
    ]);

    res.json(new ApiResponse(200, {
      jobs,
      pagination: { page: Number(page), limit: Number(limit), total, pages: Math.ceil(total / limit) },
    }));
  } catch (err) {
    next(err);
  }
};

// GET /api/v1/jobs/:id
const getJob = async (req, res, next) => {
  try {
    const job = await Job.findById(req.params.id)
      .populate('client', 'name avatar bio location')
      .populate({ path: 'proposals', populate: { path: 'freelancer', select: 'name avatar skills' } });

    if (!job) throw new ApiError(404, 'Job not found');

    await Job.findByIdAndUpdate(req.params.id, { $inc: { views: 1 } });

    res.json(new ApiResponse(200, { job }));
  } catch (err) {
    next(err);
  }
};

// POST /api/v1/jobs
const createJob = async (req, res, next) => {
  try {
    const job = await Job.create({ ...req.body, client: req.user._id });
    await cache.delPattern('jobs:*');
    res.status(201).json(new ApiResponse(201, { job }, 'Job posted successfully'));
  } catch (err) {
    next(err);
  }
};

// PATCH /api/v1/jobs/:id
const updateJob = async (req, res, next) => {
  try {
    const job = await Job.findOneAndUpdate(
      { _id: req.params.id, client: req.user._id },
      req.body,
      { new: true, runValidators: true }
    );
    if (!job) throw new ApiError(404, 'Job not found or unauthorized');
    res.json(new ApiResponse(200, { job }, 'Job updated'));
  } catch (err) {
    next(err);
  }
};

// POST /api/v1/jobs/:id/proposals
const submitProposal = async (req, res, next) => {
  try {
    const job = await Job.findById(req.params.id).populate('client', 'name email');
    if (!job) throw new ApiError(404, 'Job not found');
    if (job.status !== 'open') throw new ApiError(400, 'This job is no longer accepting proposals');

    const existing = await Proposal.findOne({ job: job._id, freelancer: req.user._id });
    if (existing) throw new ApiError(400, 'You already submitted a proposal for this job');

    const proposal = await Proposal.create({
      ...req.body,
      job: job._id,
      freelancer: req.user._id,
    });

    await Job.findByIdAndUpdate(job._id, { $push: { proposals: proposal._id } });

    // Notify client
    notificationService.notifyProposalReceived(job.client._id, req.user.name, job._id).catch(() => {});
    emailService.sendProposalReceived(job.client, req.user, job).catch(() => {});

    res.status(201).json(new ApiResponse(201, { proposal }, 'Proposal submitted'));
  } catch (err) {
    next(err);
  }
};

// PATCH /api/v1/jobs/:id/proposals/:pid/accept
const acceptProposal = async (req, res, next) => {
  try {
    const job = await Job.findOne({ _id: req.params.id, client: req.user._id });
    if (!job) throw new ApiError(404, 'Job not found or unauthorized');

    const proposal = await Proposal.findById(req.params.pid).populate('freelancer');
    if (!proposal) throw new ApiError(404, 'Proposal not found');

    // Reject all other proposals
    await Proposal.updateMany(
      { job: job._id, _id: { $ne: proposal._id } },
      { status: 'rejected' }
    );

    proposal.status = 'accepted';
    await proposal.save();

    // Create contract
    const contract = await Contract.create({
      job: job._id,
      proposal: proposal._id,
      client: req.user._id,
      freelancer: proposal.freelancer._id,
      title: job.title,
      totalAmount: proposal.bidAmount,
      transferGroup: `contract_${Date.now()}`,
    });

    await Job.findByIdAndUpdate(job._id, {
      status: 'in_progress',
      selectedProposal: proposal._id,
    });

    // Notify freelancer
    notificationService.notifyProposalAccepted(proposal.freelancer._id, job.title, contract._id).catch(() => {});
    emailService.sendContractStarted(proposal.freelancer, contract).catch(() => {});
    emailService.sendContractStarted(req.user, contract).catch(() => {});

    res.json(new ApiResponse(200, { contract }, 'Proposal accepted. Contract created.'));
  } catch (err) {
    next(err);
  }
};

// GET /api/v1/jobs/my (client's posted jobs)
const getMyJobs = async (req, res, next) => {
  try {
    const jobs = await Job.find({ client: req.user._id })
      .populate('proposals')
      .sort({ createdAt: -1 });
    res.json(new ApiResponse(200, { jobs }));
  } catch (err) {
    next(err);
  }
};

module.exports = { getJobs, getJob, createJob, updateJob, submitProposal, acceptProposal, getMyJobs };
