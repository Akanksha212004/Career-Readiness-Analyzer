const SuperAdminRequest = require("../models/SuperAdminRequest");
const User = require("../models/User");

function toPublicSuperAdminRequest(request) {
  // requestedBy may or may not be populated depending on the caller - handle
  // both a populated user doc and a bare ObjectId.
  const requestedByIsPopulated = request.requestedBy && typeof request.requestedBy === "object" && request.requestedBy.name;

  return {
    id: request._id,
    requestedBy: requestedByIsPopulated ? request.requestedBy._id : request.requestedBy,
    requestedByName: requestedByIsPopulated ? request.requestedBy.name : null,
    requestedByEmail: requestedByIsPopulated ? request.requestedBy.email : null,
    justification: request.justification,
    status: request.status,
    reviewedBy: request.reviewedBy || null,
    reviewedAt: request.reviewedAt || null,
    createdAt: request.createdAt,
  };
}

/**
 * hr only: submits a request to be promoted to super_admin. Students can't
 * reach this - requireRole(["hr"]) gates the route before this handler
 * runs. Only one 'pending' request per user is allowed at a time (checked
 * below) to stop someone from spamming the review queue.
 */
async function submitRequest(req, res, next) {
  try {
    const { justification } = req.body;

    if (!justification || typeof justification !== "string" || !justification.trim()) {
      return res.status(400).json({ error: "A justification is required." });
    }
    if (justification.trim().length < SuperAdminRequest.MIN_JUSTIFICATION_LENGTH) {
      return res
        .status(400)
        .json({ error: `Justification must be at least ${SuperAdminRequest.MIN_JUSTIFICATION_LENGTH} characters.` });
    }

    const existingPending = await SuperAdminRequest.findOne({
      requestedBy: req.userId,
      status: "pending",
    }).lean();
    if (existingPending) {
      return res.status(409).json({ error: "You already have a pending super admin request." });
    }

    const request = await SuperAdminRequest.create({
      requestedBy: req.userId,
      justification: justification.trim(),
      status: "pending",
    });

    res.status(201).json({ request: toPublicSuperAdminRequest(request) });
  } catch (err) {
    if (err.name === "ValidationError") {
      return res.status(400).json({ error: err.message });
    }
    next(err);
  }
}

/**
 * super_admin only: lists super admin requests, optionally filtered by
 * ?status=. Used for the pending-requests queue (?status=pending) on the
 * /super-admin page.
 */
async function listRequests(req, res, next) {
  try {
    const filter = {};
    const { status } = req.query;
    if (status) {
      if (!["pending", "approved", "rejected"].includes(status)) {
        return res.status(400).json({ error: "status must be one of: pending, approved, rejected." });
      }
      filter.status = status;
    }

    const requests = await SuperAdminRequest.find(filter)
      .populate("requestedBy", "name email")
      .sort({ createdAt: -1 })
      .lean();

    res.json({ requests: requests.map(toPublicSuperAdminRequest) });
  } catch (err) {
    next(err);
  }
}

/**
 * super_admin only: approves a pending request and promotes the requester's
 * User.role to "super_admin". Note: the requester's existing auth cookie
 * (if any) still carries their old role until they log in again, since the
 * role is embedded in the JWT at sign time (see authUtils.signToken) - same
 * caveat as Company approval flows elsewhere in this app.
 */
async function approveRequest(req, res, next) {
  try {
    const request = await SuperAdminRequest.findById(req.params.id);
    if (!request) {
      return res.status(404).json({ error: "Super admin request not found." });
    }
    if (request.status !== "pending") {
      return res.status(409).json({ error: "This request has already been reviewed." });
    }

    request.status = "approved";
    request.reviewedBy = req.userId;
    request.reviewedAt = new Date();
    await request.save();

    await User.findByIdAndUpdate(request.requestedBy, { $set: { role: "super_admin" } });

    const populated = await SuperAdminRequest.findById(request._id).populate("requestedBy", "name email").lean();

    res.json({ request: toPublicSuperAdminRequest(populated) });
  } catch (err) {
    if (err.name === "CastError") {
      return res.status(404).json({ error: "Super admin request not found." });
    }
    next(err);
  }
}

/**
 * super_admin only: rejects a pending request. No role change is applied.
 */
async function rejectRequest(req, res, next) {
  try {
    const request = await SuperAdminRequest.findById(req.params.id);
    if (!request) {
      return res.status(404).json({ error: "Super admin request not found." });
    }
    if (request.status !== "pending") {
      return res.status(409).json({ error: "This request has already been reviewed." });
    }

    request.status = "rejected";
    request.reviewedBy = req.userId;
    request.reviewedAt = new Date();
    await request.save();

    const populated = await SuperAdminRequest.findById(request._id).populate("requestedBy", "name email").lean();

    res.json({ request: toPublicSuperAdminRequest(populated) });
  } catch (err) {
    if (err.name === "CastError") {
      return res.status(404).json({ error: "Super admin request not found." });
    }
    next(err);
  }
}

module.exports = { submitRequest, listRequests, approveRequest, rejectRequest };
