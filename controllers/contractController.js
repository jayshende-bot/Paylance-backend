const Contract = require('../models/Contract');
const ApiError = require('../utils/ApiError');
const ApiResponse = require('../utils/ApiResponse');

// GET /api/v1/contracts  — list all contracts for the logged-in user
const getContracts = async (req, res, next) => {
  try {
    const query = req.user.role === 'client'
      ? { client: req.user._id }
      : { freelancer: req.user._id };

    const contracts = await Contract.find(query)
      .populate('client', 'name avatar')
      .populate('freelancer', 'name avatar')
      .populate('job', 'title category')
      .populate('milestones')
      .sort({ createdAt: -1 });

    res.json(new ApiResponse(200, { contracts }));
  } catch (err) {
    next(err);
  }
};

// GET /api/v1/contracts/:id  — single contract
const getContract = async (req, res, next) => {
  try {
    const contract = await Contract.findById(req.params.id)
      .populate('client', 'name avatar email')
      .populate('freelancer', 'name avatar email skills')
      .populate('job', 'title category description budget')
      .populate('milestones')
      .populate('proposal');

    if (!contract) throw new ApiError(404, 'Contract not found');

    const isParty = [contract.client._id.toString(), contract.freelancer._id.toString()]
      .includes(req.user._id.toString());
    if (!isParty && req.user.role !== 'admin') {
      throw new ApiError(403, 'You are not a party to this contract');
    }

    res.json(new ApiResponse(200, { contract }));
  } catch (err) {
    next(err);
  }
};

module.exports = { getContracts, getContract };
