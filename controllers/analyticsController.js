const Transaction = require('../models/Transaction');
const User = require('../models/User');
const Job = require('../models/Job');
const Contract = require('../models/Contract');
const ApiResponse = require('../utils/ApiResponse');

// GET /api/v1/analytics/freelancer
const getFreelancerAnalytics = async (req, res, next) => {
  try {
    const userId = req.user._id;

    // Monthly earnings (last 12 months)
    const monthlyEarnings = await Transaction.aggregate([
      { $match: { to: userId, type: 'milestone_release', status: 'completed' } },
      {
        $group: {
          _id: { year: { $year: '$createdAt' }, month: { $month: '$createdAt' } },
          total: { $sum: '$netAmount' },
          count: { $sum: 1 },
        },
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } },
      { $limit: 12 },
    ]);

    const totalEarned = await Transaction.aggregate([
      { $match: { to: userId, status: 'completed' } },
      { $group: { _id: null, total: { $sum: '$netAmount' } } },
    ]);

    const activeContracts = await Contract.countDocuments({
      freelancer: userId,
      status: 'active',
    });

    res.json(new ApiResponse(200, {
      monthlyEarnings,
      totalEarned: totalEarned[0]?.total || 0,
      earnings: req.user.earnings,
      activeContracts,
    }));
  } catch (err) {
    next(err);
  }
};

// GET /api/v1/analytics/admin
const getAdminAnalytics = async (req, res, next) => {
  try {
    const [platformRevenue, totalUsers, totalJobs, monthlyRevenue] = await Promise.all([
      Transaction.aggregate([
        { $match: { type: 'milestone_release', status: 'completed' } },
        { $group: { _id: null, total: { $sum: '$platformFee' } } },
      ]),
      User.countDocuments(),
      Job.countDocuments(),
      Transaction.aggregate([
        { $match: { type: 'milestone_release', status: 'completed' } },
        {
          $group: {
            _id: { year: { $year: '$createdAt' }, month: { $month: '$createdAt' } },
            revenue: { $sum: '$platformFee' },
            volume: { $sum: '$amount' },
          },
        },
        { $sort: { '_id.year': 1, '_id.month': 1 } },
        { $limit: 12 },
      ]),
    ]);

    res.json(new ApiResponse(200, {
      platformRevenue: platformRevenue[0]?.total || 0,
      totalUsers,
      totalJobs,
      monthlyRevenue,
    }));
  } catch (err) {
    next(err);
  }
};

module.exports = { getFreelancerAnalytics, getAdminAnalytics };
