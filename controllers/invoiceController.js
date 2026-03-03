const Milestone = require('../models/Milestone');
const Transaction = require('../models/Transaction');
const ApiError = require('../utils/ApiError');
const ApiResponse = require('../utils/ApiResponse');
const { generateInvoicePDF } = require('../services/pdfService');

// GET /api/v1/invoices/:milestoneId
const getInvoice = async (req, res, next) => {
  try {
    const milestone = await Milestone.findById(req.params.milestoneId).populate({
      path: 'contract',
      populate: [
        { path: 'client', select: 'name email' },
        { path: 'freelancer', select: 'name email' },
      ],
    });

    if (!milestone) throw new ApiError(404, 'Milestone not found');
    if (milestone.status !== 'released') throw new ApiError(400, 'Invoice only available after payment release');

    const contract = milestone.contract;
    const isParty = [contract.client._id.toString(), contract.freelancer._id.toString()]
      .includes(req.user._id.toString());
    if (!isParty) throw new ApiError(403, 'Unauthorized');

    const invoiceData = {
      invoiceNumber: `INV-${milestone._id.toString().slice(-8).toUpperCase()}`,
      issuedDate: new Date(milestone.releasedAt).toLocaleDateString(),
      clientName: contract.client.name,
      clientEmail: contract.client.email,
      freelancerName: contract.freelancer.name,
      freelancerEmail: contract.freelancer.email,
      items: [{ description: milestone.title, amount: milestone.amount }],
      subtotal: milestone.amount,
      platformFee: milestone.amount * 0.1,
      total: milestone.amount * 0.9,
      currency: milestone.currency.toUpperCase(),
    };

    const pdfBuffer = await generateInvoicePDF(invoiceData);

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="invoice-${invoiceData.invoiceNumber}.pdf"`,
      'Content-Length': pdfBuffer.length,
    });
    res.send(pdfBuffer);
  } catch (err) {
    next(err);
  }
};

module.exports = { getInvoice };
