const mongoose = require("mongoose");

const SENIORITY_LEVELS = ["internship", "entry", "mid", "senior"];
const POSTING_STATUSES = ["active", "closed", "draft"];

/**
 * A job/internship posting created by an HR user for their company. Students
 * browse the `active` subset (see postingController.listPublicPostings) and
 * can analyze their resume directly against a posting's requirements; doing
 * so is what ties an Analysis document back to this posting/company (see
 * analysisController.analyzeResume and Analysis.postingId/companyId).
 */
const postingSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    requiredSkills: {
      type: [String],
      default: [],
      validate: {
        validator: (arr) => Array.isArray(arr) && arr.length > 0,
        message: "At least one required skill must be provided.",
      },
    },
    seniority: {
      type: String,
      enum: SENIORITY_LEVELS,
      default: "entry",
    },
    // Optional free-text JD. When omitted, the analyze flow derives a
    // synthetic job description from title + requiredSkills instead (see
    // buildJobDescriptionFromPosting in analysisController.js).
    jobDescription: {
      type: String,
      trim: true,
    },
    // Scopes the posting to a company and is always taken from the
    // authenticated HR user's own companyId (never a client-supplied
    // value) - see postingController.createPosting.
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
      index: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    status: {
      type: String,
      enum: POSTING_STATUSES,
      default: "active",
      index: true,
    },
  },
  { timestamps: true }
);

postingSchema.index({ companyId: 1, createdAt: -1 });

const Posting = mongoose.model("Posting", postingSchema);

module.exports = Posting;
module.exports.SENIORITY_LEVELS = SENIORITY_LEVELS;
module.exports.POSTING_STATUSES = POSTING_STATUSES;

