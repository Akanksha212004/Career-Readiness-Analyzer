const Company = require("../models/Company");
const Posting = require("../models/Posting");
const aiServiceClient = require("../utils/aiServiceClient");

function normalizeSkills(requiredSkills) {
  if (!Array.isArray(requiredSkills)) return null;
  const cleaned = requiredSkills.map((s) => String(s).trim()).filter(Boolean);
  return cleaned.length > 0 ? cleaned : null;
}

/**
 * HR/super_admin only: create a posting for the caller's own company.
 * companyId is always taken from req.user.companyId (from the JWT), never
 * from the request body, so an HR user can never create a posting under a
 * different company.
 */
async function createPosting(req, res, next) {
  try {
    if (!req.user.companyId) {
      return res.status(400).json({ error: "Your account is not associated with a company yet." });
    }

    // Pending/rejected companies can't collect applicants yet - see the
    // approval workflow in superAdminController.js.
    const company = await Company.findById(req.user.companyId).select("status").lean();
    if (!company || company.status !== "approved") {
      return res
        .status(403)
        .json({ error: "Your company is pending approval by an administrator before you can create postings." });
    }

    const { title, seniority, jobDescription, status } = req.body;

    if (!title || typeof title !== "string" || !title.trim()) {
      return res.status(400).json({ error: "Title is required." });
    }

    const requiredSkills = normalizeSkills(req.body.requiredSkills);
    if (!requiredSkills) {
      return res.status(400).json({ error: "At least one required skill must be provided." });
    }

    const posting = await Posting.create({
      title: title.trim(),
      requiredSkills,
      seniority: seniority || undefined,
      jobDescription: jobDescription && String(jobDescription).trim() ? String(jobDescription).trim() : undefined,
      companyId: req.user.companyId,
      createdBy: req.userId,
      status: status || undefined,
    });

    res.status(201).json({ posting });
  } catch (err) {
    if (err.name === "ValidationError") {
      return res.status(400).json({ error: err.message });
    }
    next(err);
  }
}

/**
 * HR/super_admin only: lists postings belonging to the caller's own
 * company. Scoped by req.user.companyId from the JWT, same pattern as
 * adminController.getCompanyAnalyses - never a client-supplied filter.
 */
async function listPostings(req, res, next) {
  try {
    if (!req.user.companyId) {
      return res.json({ postings: [] });
    }

    const postings = await Posting.find({ companyId: req.user.companyId }).sort({ createdAt: -1 }).lean();

    res.json({ postings });
  } catch (err) {
    next(err);
  }
}

/**
 * Student-facing (any authenticated user): browse currently-open postings
 * across all companies, for the "Apply to a company posting" analyze mode.
 * Only exposes `active` postings - draft/closed postings from any company
 * stay invisible to students.
 */
async function listPublicPostings(req, res, next) {
  try {
    const postings = await Posting.find({ status: "active" })
      .populate("companyId", "name status")
      .sort({ createdAt: -1 })
      .lean();

    // Only surface postings from an approved company - a pending/rejected
    // company shouldn't be able to collect applicants (mirrors the gate on
    // createPosting above).
    const visible = postings
      .filter((p) => p.companyId && p.companyId.status === "approved")
      .map((p) => ({ ...p, companyId: { _id: p.companyId._id, name: p.companyId.name } }));

    res.json({ postings: visible });
  } catch (err) {
    next(err);
  }
}

/**
 * HR/super_admin only: edit a posting. The caller's company must match the
 * posting's company - an HR user from Company A can never edit Company B's
 * posting, even by guessing/enumerating ids.
 */
async function updatePosting(req, res, next) {
  try {
    const posting = await Posting.findById(req.params.id);
    if (!posting) {
      return res.status(404).json({ error: "Posting not found." });
    }

    if (!req.user.companyId || String(posting.companyId) !== String(req.user.companyId)) {
      return res.status(403).json({ error: "You can only edit postings that belong to your company." });
    }

    const { title, seniority, jobDescription, status } = req.body;

    if (title !== undefined) {
      if (typeof title !== "string" || !title.trim()) {
        return res.status(400).json({ error: "Title cannot be empty." });
      }
      posting.title = title.trim();
    }

    if (req.body.requiredSkills !== undefined) {
      const requiredSkills = normalizeSkills(req.body.requiredSkills);
      if (!requiredSkills) {
        return res.status(400).json({ error: "At least one required skill must be provided." });
      }
      posting.requiredSkills = requiredSkills;
    }

    if (seniority !== undefined) posting.seniority = seniority;
    if (jobDescription !== undefined) {
      posting.jobDescription = jobDescription && String(jobDescription).trim() ? String(jobDescription).trim() : undefined;
    }
    if (status !== undefined) posting.status = status;

    await posting.save();

    res.json({ posting });
  } catch (err) {
    if (err.name === "ValidationError") {
      return res.status(400).json({ error: err.message });
    }
    if (err.name === "CastError") {
      return res.status(404).json({ error: "Posting not found." });
    }
    next(err);
  }
}

/**
 * HR/super_admin only: advisory JD-quality check for the posting create/edit
 * form - proxies to ai-service's /api/jd-quality (see jd_quality.py). Never
 * blocks posting creation; the frontend calls this live as HR types the JD
 * and shows the flags inline, but createPosting/updatePosting above don't
 * call or depend on this at all.
 */
async function checkJdQuality(req, res, next) {
  try {
    const { jobDescription, seniority } = req.body;
    if (!jobDescription || typeof jobDescription !== "string" || !jobDescription.trim()) {
      return res.status(400).json({ error: "jobDescription is required." });
    }

    const report = await aiServiceClient.checkJdQuality({ jobDescription, seniority });
    res.json({
      qualityScore: report.quality_score,
      flags: (report.flags || []).map((f) => ({ flag: f.flag, severity: f.severity, detail: f.detail })),
    });
  } catch (err) {
    if (err.response) {
      return res.status(err.response.status || 502).json({
        error: err.response.data?.detail || "ai-service rejected the JD quality check.",
      });
    }
    next(err);
  }
}

module.exports = { createPosting, listPostings, listPublicPostings, updatePosting, checkJdQuality };


