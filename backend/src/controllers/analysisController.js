const aiServiceClient = require("../utils/aiServiceClient");
const Analysis = require("../models/Analysis");
const Posting = require("../models/Posting");

function mapScoreComponentsToDb(components) {
  return (components || []).map((c) => ({
    key: c.key,
    label: c.label,
    rawScore: c.raw_score,
    weight: c.weight,
    weightedPoints: c.weighted_points,
  }));
}

function mapScoreAdjustmentsToDb(adjustments) {
  return (adjustments || []).map((a) => ({
    key: a.key,
    label: a.label,
    kind: a.kind,
    detail: a.detail,
    multiplier: a.multiplier,
    percentImpact: a.percent_impact,
    points: a.points,
  }));
}

function mapScoreToDb(score) {
  return {
    skillsScore: score.skills_score,
    projectsScore: score.projects_score,
    experienceScore: score.experience_score,
    educationScore: score.education_score,
    overallScore: score.overall_score,
    baseScore: score.base_score,
    finalScore: score.final_score,
    components: mapScoreComponentsToDb(score.components),
    adjustments: mapScoreAdjustmentsToDb(score.adjustments),
  };
}

function mapSkillMatchesToDb(matches) {
  return matches.map((m) => ({
    skill: m.skill,
    category: m.category,
    matched: m.matched,
    matchType: m.match_type,
    matchScore: m.match_score,
    matchedResumePhrase: m.matched_resume_phrase,
  }));
}

function mapAtsIssuesToDb(issues) {
  return issues.map((i) => ({ issue: i.issue, severity: i.severity, detail: i.detail }));
}

function mapSuggestionsToDb(suggestions) {
  return suggestions.map((s) => ({ type: s.type, text: s.text, priority: s.priority }));
}

function mapHiddenTextWarningToDb(warning) {
  if (!warning) return undefined;
  return {
    detected: warning.detected,
    findings: (warning.findings || []).map((f) => ({
      method: f.method,
      detail: f.detail,
      sampleText: f.sample_text,
    })),
    message: warning.message,
  };
}

function mapGithubVerificationsToDb(verifications) {
  return (verifications || []).map((v) => ({
    url: v.url,
    owner: v.owner,
    repo: v.repo,
    status: v.status,
    verified: v.verified,
    lastPushedAt: v.last_pushed_at,
    hasReadme: v.has_readme,
    sizeKb: v.size_kb,
    stargazersCount: v.stargazers_count,
    isFork: v.is_fork,
    isArchived: v.is_archived,
    commitCount: v.commit_count,
    hasTests: v.has_tests,
    authenticityScore: v.authenticity_score,
    note: v.note,
  }));
}

/**
 * Maps the ai-service response (snake_case, Pydantic) to the frontend-facing
 * shape (camelCase) consistently, whether the analysis came from a fresh
 * request or was loaded back out of MongoDB history.
 */
function mapSkillMatchesToApi(matches) {
  return matches.map((m) => ({
    skill: m.skill,
    category: m.category,
    matched: m.matched,
    matchType: m.match_type,
    matchScore: m.match_score,
    matchedResumePhrase: m.matched_resume_phrase,
  }));
}

/**
 * The ai-service only understands `role_id` (fixed dataset) or a freeform
 * `job_description` string - it has no concept of a Posting. So when a
 * student analyzes against a posting, we derive the job description text
 * we send to ai-service from the posting: use its custom JD text if the HR
 * user wrote one, otherwise synthesize one from the title + required
 * skills so skill matching still has something concrete to compare against.
 */
function buildJobDescriptionFromPosting(posting) {
  if (posting.jobDescription && posting.jobDescription.trim()) {
    return posting.jobDescription.trim();
  }
  const skillsLine = (posting.requiredSkills || []).join(", ");
  return `${posting.title}${posting.seniority ? ` (${posting.seniority})` : ""}\n\nRequired skills: ${skillsLine}`;
}

function toApiResponse(aiResult, record) {
  return {
    id: record?._id || null,
    roleId: record ? record.roleId : aiResult.role_id,
    roleTitle: record ? record.roleTitle : aiResult.role_title,
    roleLevel: record ? record.roleLevel : aiResult.role_level,
    usedCustomJd: aiResult.used_custom_jd,
    atsFriendly: aiResult.ats_friendly,
    atsIssues: mapAtsIssuesToDb(aiResult.ats_issues),
    hiddenTextWarning: mapHiddenTextWarningToDb(aiResult.hidden_text_warning),
    githubVerifications: mapGithubVerificationsToDb(aiResult.github_verifications),
    score: mapScoreToDb(aiResult.score),
    skillMatches: mapSkillMatchesToApi(aiResult.skill_matches),
    matchedSkillCount: aiResult.matched_skill_count,
    totalRequiredSkillCount: aiResult.total_required_skill_count,
    detectedProjectsCount: aiResult.detected_projects_count,
    detectedExperienceMonths: aiResult.detected_experience_months,
    educationDetected: aiResult.education_detected,
    suggestions: mapSuggestionsToDb(aiResult.suggestions),
    companyId: record?.companyId || null,
    postingId: record?.postingId || null,
    appliedToCompany: record?.appliedToCompany || false,
    status: record?.status || "new",
  };
}

async function analyzeResume(req, res, next) {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No resume file uploaded. Field name must be 'file'." });
    }

    const { roleId, jobDescription, postingId } = req.body;
    if (!roleId && !jobDescription && !postingId) {
      return res.status(400).json({ error: "Provide one of roleId, jobDescription, or postingId." });
    }

    let posting = null;
    if (postingId) {
      posting = await Posting.findById(postingId).lean();
      if (!posting) {
        return res.status(404).json({ error: "Posting not found." });
      }
      if (posting.status !== "active") {
        return res.status(400).json({ error: "This posting is no longer accepting applications." });
      }
    }

    const effectiveJobDescription = posting ? buildJobDescriptionFromPosting(posting) : jobDescription;

    const aiResult = await aiServiceClient.analyzeResume({
      fileBuffer: req.file.buffer,
      filename: req.file.originalname,
      mimetype: req.file.mimetype,
      roleId: posting ? undefined : roleId || undefined,
      jobDescription: effectiveJobDescription || undefined,
    });

    // When analyzing against a posting, prefer the posting's own
    // title/seniority for display over ai-service's generic
    // "Custom Job Description" placeholder.
    const recordRoleId = posting ? `posting:${posting._id}` : aiResult.role_id;
    const recordRoleTitle = posting ? posting.title : aiResult.role_title;
    const recordRoleLevel = posting ? (posting.seniority === "internship" ? "internship" : "job") : aiResult.role_level;

    const record = await Analysis.create({
      userId: req.userId,
      companyId: posting ? posting.companyId : req.user?.companyId || undefined,
      postingId: posting ? posting._id : undefined,
      // Selecting a posting via this flow *is* the apply action - see the
      // opt-in visibility note on Analysis.appliedToCompany.
      appliedToCompany: Boolean(posting),
      resumeFilename: req.file.originalname,
      roleId: recordRoleId,
      roleTitle: recordRoleTitle,
      roleLevel: recordRoleLevel,
      usedCustomJd: aiResult.used_custom_jd,
      jobDescriptionSnapshot: aiResult.used_custom_jd ? effectiveJobDescription : undefined,
      score: mapScoreToDb(aiResult.score),
      skillMatches: mapSkillMatchesToDb(aiResult.skill_matches),
      matchedSkillCount: aiResult.matched_skill_count,
      totalRequiredSkillCount: aiResult.total_required_skill_count,
      atsFriendly: aiResult.ats_friendly,
      atsIssues: mapAtsIssuesToDb(aiResult.ats_issues),
      hiddenTextWarning: mapHiddenTextWarningToDb(aiResult.hidden_text_warning),
      githubVerifications: mapGithubVerificationsToDb(aiResult.github_verifications),
      detectedProjectsCount: aiResult.detected_projects_count,
      detectedExperienceMonths: aiResult.detected_experience_months,
      educationDetected: aiResult.education_detected,
      suggestions: mapSuggestionsToDb(aiResult.suggestions),
    });

    res.status(201).json({
      ...toApiResponse(aiResult, record),
      createdAt: record.createdAt,
    });
  } catch (err) {
    if (err.response) {
      // Error surfaced by ai-service (e.g. bad file, unsupported type)
      return res.status(err.response.status || 502).json({
        error: err.response.data?.detail || "ai-service rejected the request.",
      });
    }
    next(err);
  }
}

async function getHistory(req, res, next) {
  try {
    const { roleId } = req.query;
    const filter = { userId: req.userId };
    if (roleId) filter.roleId = roleId;

    const records = await Analysis.find(filter).sort({ createdAt: 1 }).lean();

    const history = records.map((r) => ({
      id: r._id,
      resumeFilename: r.resumeFilename,
      roleId: r.roleId,
      roleTitle: r.roleTitle,
      roleLevel: r.roleLevel,
      usedCustomJd: r.usedCustomJd,
      score: r.score,
      matchedSkillCount: r.matchedSkillCount,
      totalRequiredSkillCount: r.totalRequiredSkillCount,
      atsFriendly: r.atsFriendly,
      detectedProjectsCount: r.detectedProjectsCount,
      detectedExperienceMonths: r.detectedExperienceMonths,
      companyId: r.companyId || null,
      postingId: r.postingId || null,
      appliedToCompany: r.appliedToCompany || false,
      status: r.status || "new",
      createdAt: r.createdAt,
    }));

    res.json({ history });
  } catch (err) {
    next(err);
  }
}

/**
 * Full single-analysis response shape - used both for a student viewing
 * their own analysis (getAnalysisById below) and for HR viewing a
 * candidate's analysis (adminController.getAnalysisDetail), so the two
 * surfaces render from an identical schema rather than drifting apart.
 */
function serializeAnalysisDetail(record) {
  return {
    id: record._id,
    resumeFilename: record.resumeFilename,
    roleId: record.roleId,
    roleTitle: record.roleTitle,
    roleLevel: record.roleLevel,
    usedCustomJd: record.usedCustomJd,
    score: record.score,
    skillMatches: record.skillMatches,
    matchedSkillCount: record.matchedSkillCount,
    totalRequiredSkillCount: record.totalRequiredSkillCount,
    atsFriendly: record.atsFriendly,
    atsIssues: record.atsIssues,
    hiddenTextWarning: record.hiddenTextWarning || { detected: false, findings: [], message: "" },
    githubVerifications: record.githubVerifications || [],
    detectedProjectsCount: record.detectedProjectsCount,
    detectedExperienceMonths: record.detectedExperienceMonths,
    educationDetected: record.educationDetected,
    suggestions: record.suggestions,
    companyId: record.companyId || null,
    postingId: record.postingId || null,
    appliedToCompany: record.appliedToCompany || false,
    status: record.status || "new",
    createdAt: record.createdAt,
  };
}

async function getAnalysisById(req, res, next) {
  try {
    // Scope to the requesting user so one account can't view another
    // account's analysis by guessing/enumerating ids.
    const record = await Analysis.findOne({ _id: req.params.id, userId: req.userId }).lean();
    if (!record) {
      return res.status(404).json({ error: "Analysis not found." });
    }
    res.json(serializeAnalysisDetail(record));
  } catch (err) {
    next(err);
  }
}

module.exports = { analyzeResume, getHistory, getAnalysisById, serializeAnalysisDetail };


