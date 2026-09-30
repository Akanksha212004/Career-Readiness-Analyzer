const mongoose = require("mongoose");

/**
 * One document per resume-analysis attempt. Storing every attempt (rather
 * than overwriting a single "latest" record) is what powers the
 * version-history / progress-tracking feature: a student can see their
 * score trend across multiple resume iterations for the same target role.
 */
const skillMatchSchema = new mongoose.Schema(
  {
    skill: String,
    category: String,
    matched: Boolean,
    matchType: String,
    matchScore: Number,
    matchedResumePhrase: String,
  },
  { _id: false }
);

const atsIssueSchema = new mongoose.Schema(
  {
    issue: String,
    severity: String,
    detail: String,
  },
  { _id: false }
);

const suggestionSchema = new mongoose.Schema(
  {
    type: String,
    text: String,
    priority: String,
  },
  { _id: false }
);

const scoreComponentSchema = new mongoose.Schema(
  {
    key: String,
    label: String,
    rawScore: Number,
    weight: Number,
    weightedPoints: Number,
  },
  { _id: false }
);

const scoreAdjustmentSchema = new mongoose.Schema(
  {
    key: String,
    label: String,
    kind: String,
    detail: String,
    multiplier: Number,
    percentImpact: Number,
    points: Number,
  },
  { _id: false }
);

const scoreBreakdownSchema = new mongoose.Schema(
  {
    skillsScore: Number,
    projectsScore: Number,
    experienceScore: Number,
    educationScore: Number,
    overallScore: Number,
    // "Why this score?" explanation - how base_score was built from the
    // weighted components, and which adjustments were applied on top.
    baseScore: Number,
    finalScore: Number,
    components: [scoreComponentSchema],
    adjustments: [scoreAdjustmentSchema],
  },
  { _id: false }
);

const hiddenTextFindingSchema = new mongoose.Schema(
  {
    method: String,
    detail: String,
    sampleText: String,
  },
  { _id: false }
);

const hiddenTextWarningSchema = new mongoose.Schema(
  {
    detected: Boolean,
    findings: [hiddenTextFindingSchema],
    message: String,
  },
  { _id: false }
);

const githubRepoVerificationSchema = new mongoose.Schema(
  {
    url: String,
    owner: String,
    repo: String,
    status: String,
    verified: Boolean,
    lastPushedAt: String,
    hasReadme: Boolean,
    sizeKb: Number,
    stargazersCount: Number,
    isFork: Boolean,
    isArchived: Boolean,
    // Commit count, test-file presence, and the resulting 0-1 authenticity
    // composite - see ai-service/app/core/github_verifier.py. Feeds
    // scorer.py's small score bonus/malus (score.adjustments, key
    // "github_authenticity") and is shown as-is to HR for explainability.
    commitCount: Number,
    hasTests: Boolean,
    authenticityScore: Number,
    note: String,
  },
  { _id: false }
);

const analysisSchema = new mongoose.Schema(
  {
    // Owning user, sourced from the authenticated session (req.userId) -
    // never from a client-supplied string. This is what actually secures
    // history/analyses to a specific account.
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },

    // Set only when this analysis was run against a specific company
    // posting (see postingId below). Denormalized from Posting.companyId
    // at creation time so /api/admin/analyses can filter by company with a
    // single indexed query. Left unset for analyses run against a generic
    // role type or a freeform pasted job description.
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: "Company", index: true },

    // Set when the student picked "Apply to a company posting" and chose a
    // specific Posting to analyze against (see analysisController.js).
    // Optional/unset for the generic role-type and custom-JD analyze modes.
    postingId: { type: mongoose.Schema.Types.ObjectId, ref: "Posting", index: true },

    // OPT-IN visibility flag. An analysis only becomes visible to the
    // posting's company (via /api/admin/analyses) once this is true - i.e.
    // once the student has explicitly applied. Simply analyzing against a
    // posting's requirements never leaks the resume to HR on its own;
    // today the "Apply to this posting" analyze action sets this
    // immediately, but keeping it a distinct flag (rather than reusing
    // postingId's presence) leaves room for a future "analyze without
    // applying yet" flow without changing the visibility contract.
    appliedToCompany: { type: Boolean, default: false },

    // Hiring-pipeline stage, set by HR via PATCH /api/admin/analyses/:id/status
    // (see adminController.updateAnalysisStatus). Only meaningful once
    // appliedToCompany is true; left at the default for analyses that were
    // never submitted as an application.
    status: {
      type: String,
      enum: ["new", "reviewed", "shortlisted", "rejected", "hired"],
      default: "new",
    },

    resumeFilename: { type: String, required: true },

    roleId: { type: String, required: true },
    roleTitle: { type: String, required: true },
    roleLevel: { type: String, required: true },
    usedCustomJd: { type: Boolean, default: false },
    jobDescriptionSnapshot: { type: String }, // only set when usedCustomJd is true

    score: { type: scoreBreakdownSchema, required: true },
    skillMatches: [skillMatchSchema],
    matchedSkillCount: Number,
    totalRequiredSkillCount: Number,

    atsFriendly: Boolean,
    atsIssues: [atsIssueSchema],

    // Persisted so HR (and the student, later) can still see these signals
    // when reviewing a *stored* analysis, not just in the split-second
    // response right after uploading - previously these two were computed
    // by ai-service but silently dropped before ever reaching the DB.
    hiddenTextWarning: hiddenTextWarningSchema,
    githubVerifications: [githubRepoVerificationSchema],

    detectedProjectsCount: Number,
    detectedExperienceMonths: Number,
    educationDetected: Boolean,

    suggestions: [suggestionSchema],
  },
  { timestamps: true }
);

analysisSchema.index({ userId: 1, roleId: 1, createdAt: -1 });

module.exports = mongoose.model("Analysis", analysisSchema);

