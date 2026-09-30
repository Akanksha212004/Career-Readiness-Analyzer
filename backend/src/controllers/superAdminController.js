const Company = require("../models/Company");

function toPublicCompany(company) {
  return {
    id: company._id,
    name: company.name,
    domain: company.domain,
    status: company.status,
    reviewedBy: company.reviewedBy || null,
    reviewedAt: company.reviewedAt || null,
    createdAt: company.createdAt,
  };
}

/**
 * super_admin only: lists companies, optionally filtered by ?status=.
 * Used both for the pending-requests queue (?status=pending) and the
 * active-companies list (?status=approved) on the /super-admin page.
 */
async function listCompanies(req, res, next) {
  try {
    const filter = {};
    const { status } = req.query;
    if (status) {
      if (!["pending", "approved", "rejected"].includes(status)) {
        return res.status(400).json({ error: "status must be one of: pending, approved, rejected." });
      }
      filter.status = status;
    }

    const companies = await Company.find(filter).sort({ createdAt: -1 }).lean();
    res.json({ companies: companies.map(toPublicCompany) });
  } catch (err) {
    next(err);
  }
}

async function approveCompany(req, res, next) {
  try {
    const company = await Company.findByIdAndUpdate(
      req.params.id,
      { $set: { status: "approved", reviewedBy: req.userId, reviewedAt: new Date() } },
      { new: true }
    ).lean();

    if (!company) {
      return res.status(404).json({ error: "Company not found." });
    }

    res.json({ company: toPublicCompany(company) });
  } catch (err) {
    if (err.name === "CastError") {
      return res.status(404).json({ error: "Company not found." });
    }
    next(err);
  }
}

async function rejectCompany(req, res, next) {
  try {
    const company = await Company.findByIdAndUpdate(
      req.params.id,
      { $set: { status: "rejected", reviewedBy: req.userId, reviewedAt: new Date() } },
      { new: true }
    ).lean();

    if (!company) {
      return res.status(404).json({ error: "Company not found." });
    }

    res.json({ company: toPublicCompany(company) });
  } catch (err) {
    if (err.name === "CastError") {
      return res.status(404).json({ error: "Company not found." });
    }
    next(err);
  }
}

module.exports = { listCompanies, approveCompany, rejectCompany };

