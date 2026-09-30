const mongoose = require("mongoose");

const MIN_JUSTIFICATION_LENGTH = 20;

/**
 * A self-submitted request from an 'hr' user asking to be promoted to
 * 'super_admin'. New requests start out 'pending' via the self-request flow
 * (see superAdminRequestController.submitRequest) - an existing super_admin
 * reviews and flips them to 'approved' or 'rejected' via
 * /api/super-admin-requests/:id/approve|reject (see
 * superAdminRequestController.js). Approving a request sets the requester's
 * User.role to 'super_admin'.
 *
 * Mirrors the Company registration/approval pattern (see Company.js).
 */
const superAdminRequestSchema = new mongoose.Schema(
  {
    requestedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    justification: {
      type: String,
      required: true,
      trim: true,
      minlength: [MIN_JUSTIFICATION_LENGTH, `Justification must be at least ${MIN_JUSTIFICATION_LENGTH} characters.`],
    },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
    },
    // Set once a super_admin approves or rejects the request. Left unset
    // while status is "pending".
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    reviewedAt: {
      type: Date,
    },
  },
  { timestamps: true }
);

superAdminRequestSchema.statics.MIN_JUSTIFICATION_LENGTH = MIN_JUSTIFICATION_LENGTH;

module.exports = mongoose.model("SuperAdminRequest", superAdminRequestSchema);

