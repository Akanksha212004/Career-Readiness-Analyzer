const mongoose = require("mongoose");

/**
 * An employer/organization that 'hr' users belong to. New companies start
 * out 'pending' via the self-signup flow (see companyController.registerCompany)
 * - a super_admin reviews and flips them to 'approved' or 'rejected' via
 * /api/super-admin/companies/:id/approve|reject (see superAdminController.js).
 * Posting creation and public posting visibility are gated on 'approved'
 * (see postingController.js) so a pending/rejected company can't collect
 * applicants yet.
 */
const companySchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
  },
  domain: {
    type: String,
    required: true,
    trim: true,
    lowercase: true,
  },
  status: {
    type: String,
    enum: ["pending", "approved", "rejected"],
    default: "pending",
  },
  // Set once a super_admin approves or rejects the company (see
  // superAdminController.js). Left unset while status is "pending".
  reviewedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  },
  reviewedAt: {
    type: Date,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model("Company", companySchema);

