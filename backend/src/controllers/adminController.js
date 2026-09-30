const mongoose = require("mongoose");
const Analysis = require("../models/Analysis");
const Posting = require("../models/Posting");
const { serializeAnalysisDetail } = require("./analysisController");

const MAX_PAGE_LIMIT = 100;
const DEFAULT_PAGE_LIMIT = 20;
const PIPELINE_STATUSES = ["new", "reviewed", "shortlisted", "rejected", "hired"];

/**
 * HR/super_admin-only: lists analyses belonging to the caller's company.
 * Scoped by req.user.companyId (read from the JWT via authMiddleware),
 * never a client-supplied value - so one company's HR user can never
 * enumerate another company's candidate data by guessing an id or query
 * param.
 *
 * OPT-IN visibility: only analyses where the student explicitly applied
 * (appliedToCompany: true) are returned. Simply analyzing a resume against
 * one of the company's postings does not, by itself, expose that resume to
 * HR - see Analysis.appliedToCompany.
 *
 * Supports pagination (?page=&limit=) and filters: ?postingId=,
 * ?minScore=&maxScore= (on score.overallScore), ?startDate=&endDate= (on
 * createdAt, ISO strings), plus ?sortBy=score|date&order=asc|desc.
 */
async function getCompanyAnalyses(req, res, next) {
  try {
    if (!req.user.companyId) {
      // hr/super_admin user not (yet) associated with a company - nothing
      // to scope the query to, so return an empty page rather than erroring.
      return res.json({ analyses: [], pagination: { page: 1, limit: DEFAULT_PAGE_LIMIT, total: 0, pages: 0 } });
    }

    const filter = { companyId: req.user.companyId, appliedToCompany: true };

    if (req.query.postingId) {
      filter.postingId = req.query.postingId;
    }

    const minScore = req.query.minScore !== undefined ? Number(req.query.minScore) : undefined;
    const maxScore = req.query.maxScore !== undefined ? Number(req.query.maxScore) : undefined;
    if ((minScore !== undefined && !Number.isNaN(minScore)) || (maxScore !== undefined && !Number.isNaN(maxScore))) {
      filter["score.overallScore"] = {};
      if (minScore !== undefined && !Number.isNaN(minScore)) filter["score.overallScore"].$gte = minScore;
      if (maxScore !== undefined && !Number.isNaN(maxScore)) filter["score.overallScore"].$lte = maxScore;
    }

    if (req.query.startDate || req.query.endDate) {
      filter.createdAt = {};
      if (req.query.startDate) {
        const start = new Date(req.query.startDate);
        if (!Number.isNaN(start.getTime())) filter.createdAt.$gte = start;
      }
      if (req.query.endDate) {
        const end = new Date(req.query.endDate);
        if (!Number.isNaN(end.getTime())) filter.createdAt.$lte = end;
      }
    }

    const page = Math.max(1, Math.trunc(Number(req.query.page)) || 1);
    const limit = Math.min(MAX_PAGE_LIMIT, Math.max(1, Math.trunc(Number(req.query.limit)) || DEFAULT_PAGE_LIMIT));

    const sortField = req.query.sortBy === "score" ? "score.overallScore" : "createdAt";
    const sortOrder = req.query.order === "asc" ? 1 : -1;

    const [analyses, total] = await Promise.all([
      Analysis.find(filter)
        .populate("postingId", "title")
        .populate("userId", "name email")
        .sort({ [sortField]: sortOrder })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Analysis.countDocuments(filter),
    ]);

    res.json({
      analyses,
      pagination: { page, limit, total, pages: Math.max(1, Math.ceil(total / limit)) },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * HR/super_admin-only: full detail for a single candidate analysis. Scoped
 * to companyId + appliedToCompany the same way getCompanyAnalyses is, so an
 * HR user can never fetch an analysis outside their company (or one that
 * was never opted-in) by guessing an id.
 *
 * Reuses analysisController.serializeAnalysisDetail so the shape returned
 * here is identical to what the student sees on their own dashboard.
 */
async function getAnalysisDetail(req, res, next) {
  try {
    if (!req.user.companyId) {
      return res.status(404).json({ error: "Analysis not found." });
    }

    const record = await Analysis.findOne({
      _id: req.params.id,
      companyId: req.user.companyId,
      appliedToCompany: true,
    }).lean();

    if (!record) {
      return res.status(404).json({ error: "Analysis not found." });
    }

    // Longitudinal tracking: if this candidate has applied to this company
    // more than once (e.g. re-analyzed an updated resume, or applied to a
    // different posting), surface their score history so HR can see
    // improvement over time - "Score 3 months ago: 45 -> Now: 68".
    const applicationHistory = await Analysis.find({
      userId: record.userId,
      companyId: req.user.companyId,
      appliedToCompany: true,
    })
      .select("score.overallScore createdAt postingId")
      .populate("postingId", "title")
      .sort({ createdAt: 1 })
      .lean();

    res.json({
      ...serializeAnalysisDetail(record),
      applicationHistory: applicationHistory.map((a) => ({
        id: a._id,
        score: Math.round(a.score?.overallScore ?? 0),
        postingTitle: a.postingId?.title || null,
        createdAt: a.createdAt,
        isCurrent: String(a._id) === String(record._id),
      })),
    });
  } catch (err) {
    if (err.name === "CastError") {
      return res.status(404).json({ error: "Analysis not found." });
    }
    next(err);
  }
}

/**
 * HR/super_admin-only: company-scoped aggregate stats for the overview
 * dashboard - total candidates, average readiness score, a date-wise score
 * trend, and a per-posting breakdown. Same opt-in scoping as the endpoints
 * above (companyId + appliedToCompany: true).
 */
async function getDashboardStats(req, res, next) {
  try {
    if (!req.user.companyId) {
      return res.json({ totalCandidates: 0, totalApplications: 0, averageScore: 0, scoreTrend: [], postingBreakdown: [] });
    }

    const companyId = new mongoose.Types.ObjectId(String(req.user.companyId));
    const baseMatch = { companyId, appliedToCompany: true };

    const [totalsResult, scoreTrendRaw, postingBreakdownRaw] = await Promise.all([
      Analysis.aggregate([
        { $match: baseMatch },
        {
          $group: {
            _id: null,
            totalApplications: { $sum: 1 },
            averageScore: { $avg: "$score.overallScore" },
            candidateIds: { $addToSet: "$userId" },
          },
        },
      ]),
      Analysis.aggregate([
        { $match: baseMatch },
        {
          $group: {
            _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
            averageScore: { $avg: "$score.overallScore" },
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]),
      Analysis.aggregate([
        { $match: { ...baseMatch, postingId: { $ne: null } } },
        {
          $group: {
            _id: "$postingId",
            candidateCount: { $sum: 1 },
            averageScore: { $avg: "$score.overallScore" },
          },
        },
      ]),
    ]);

    const totals = totalsResult[0];

    const postingIds = postingBreakdownRaw.map((p) => p._id);
    const postings = await Posting.find({ _id: { $in: postingIds } }).select("title status").lean();
    const postingById = new Map(postings.map((p) => [String(p._id), p]));

    res.json({
      totalCandidates: totals?.candidateIds?.length || 0,
      totalApplications: totals?.totalApplications || 0,
      averageScore: totals ? Math.round(totals.averageScore) : 0,
      scoreTrend: scoreTrendRaw.map((d) => ({
        date: d._id,
        averageScore: Math.round(d.averageScore),
        count: d.count,
      })),
      postingBreakdown: postingBreakdownRaw.map((p) => ({
        postingId: String(p._id),
        title: postingById.get(String(p._id))?.title || "Unknown posting",
        status: postingById.get(String(p._id))?.status || null,
        candidateCount: p.candidateCount,
        averageScore: Math.round(p.averageScore),
      })),
    });
  } catch (err) {
    next(err);
  }
}

/**
 * HR/super_admin-only: updates a single candidate's pipeline stage (New /
 * Reviewed / Shortlisted / Rejected / Hired). Same companyId +
 * appliedToCompany scoping as the read endpoints above, so HR can only ever
 * move candidates that actually applied to their own company.
 */
async function updateAnalysisStatus(req, res, next) {
  try {
    const { status } = req.body;
    if (!PIPELINE_STATUSES.includes(status)) {
      return res.status(400).json({ error: `Status must be one of: ${PIPELINE_STATUSES.join(", ")}.` });
    }

    if (!req.user.companyId) {
      return res.status(404).json({ error: "Analysis not found." });
    }

    const record = await Analysis.findOneAndUpdate(
      { _id: req.params.id, companyId: req.user.companyId, appliedToCompany: true },
      { $set: { status } },
      { new: true }
    ).lean();

    if (!record) {
      return res.status(404).json({ error: "Analysis not found." });
    }

    res.json(serializeAnalysisDetail(record));
  } catch (err) {
    if (err.name === "CastError") {
      return res.status(404).json({ error: "Analysis not found." });
    }
    next(err);
  }
}

/**
 * HR/super_admin-only: aggregates every applied candidate's skill_matches
 * for one posting to answer "which skill are the most candidates failing
 * on?" - powers the /admin/skill-insights page. Ownership-checked the same
 * way as everything else here: the posting must belong to the caller's
 * company.
 */
async function getPostingSkillGaps(req, res, next) {
  try {
    if (!req.user.companyId) {
      return res.status(404).json({ error: "Posting not found." });
    }

    const posting = await Posting.findOne({ _id: req.params.id, companyId: req.user.companyId }).lean();
    if (!posting) {
      return res.status(404).json({ error: "Posting not found." });
    }

    const postingId = new mongoose.Types.ObjectId(String(posting._id));
    const companyId = new mongoose.Types.ObjectId(String(req.user.companyId));

    const [totalsResult, skillRows] = await Promise.all([
      Analysis.countDocuments({ postingId, companyId, appliedToCompany: true }),
      Analysis.aggregate([
        { $match: { postingId, companyId, appliedToCompany: true } },
        { $unwind: "$skillMatches" },
        {
          $group: {
            _id: "$skillMatches.skill",
            category: { $first: "$skillMatches.category" },
            candidateCount: { $sum: 1 },
            failedCount: { $sum: { $cond: ["$skillMatches.matched", 0, 1] } },
          },
        },
        {
          $addFields: {
            failRate: {
              $round: [{ $multiply: [{ $divide: ["$failedCount", "$candidateCount"] }, 100] }, 1],
            },
          },
        },
        { $sort: { failRate: -1, candidateCount: -1 } },
      ]),
    ]);

    res.json({
      postingId: String(posting._id),
      postingTitle: posting.title,
      totalCandidates: totalsResult,
      skillGaps: skillRows.map((s) => ({
        skill: s._id,
        category: s.category,
        candidateCount: s.candidateCount,
        failedCount: s.failedCount,
        failRate: s.failRate,
      })),
    });
  } catch (err) {
    if (err.name === "CastError") {
      return res.status(404).json({ error: "Posting not found." });
    }
    next(err);
  }
}

module.exports = {
  getCompanyAnalyses,
  getAnalysisDetail,
  getDashboardStats,
  updateAnalysisStatus,
  getPostingSkillGaps,
};

