const mongoose = require("mongoose");
const crypto = require("crypto");

const SUB_ROLES = ["hr_admin", "hr_viewer"];
// "declined" is set when an already-logged-in user explicitly denies an
// invite via the pending-invite banner (see companyController.declineInvite).
const MEMBER_STATUSES = ["invited", "active", "declined"];

/**
 * Team membership within a company, one document per (company, person).
 * Two lifecycles are represented:
 *  - An invited-but-not-yet-accepted teammate: status "invited", userId
 *    unset, invitedEmail + inviteToken set (see companyController.inviteTeammate).
 *  - An active teammate: status "active", userId set, inviteToken cleared
 *    (see companyController.acceptInvite).
 *
 * subRole is a finer-grained permission within the coarse `hr` User.role:
 * "hr_admin" can invite further teammates and manage company settings,
 * "hr_viewer" can use the dashboard/candidates/postings views but not invite.
 * The very first member created for a company (its self-signup founder) is
 * always "hr_admin" - see companyController.registerCompany.
 */
const companyMemberSchema = new mongoose.Schema(
  {
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: "Company", required: true, index: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", index: true },
    subRole: { type: String, enum: SUB_ROLES, default: "hr_viewer" },
    status: { type: String, enum: MEMBER_STATUSES, default: "invited" },
    invitedEmail: { type: String, trim: true, lowercase: true, required: true },
    invitedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    inviteToken: { type: String, index: true },
  },
  { timestamps: true }
);

// A user can only hold one membership per company. Partial index so this
// only applies once userId is actually set (an invited-but-unaccepted row
// has no userId yet).
companyMemberSchema.index(
  { companyId: 1, userId: 1 },
  { unique: true, partialFilterExpression: { userId: { $type: "objectId" } } }
);

companyMemberSchema.statics.generateInviteToken = function generateInviteToken() {
  return crypto.randomBytes(24).toString("hex");
};

module.exports = mongoose.model("CompanyMember", companyMemberSchema);
module.exports.SUB_ROLES = SUB_ROLES;
module.exports.MEMBER_STATUSES = MEMBER_STATUSES;

