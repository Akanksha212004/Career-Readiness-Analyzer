export type RoleListItem = {
  role_id: string;
  title: string;
  level: "internship" | "job";
};

export type UserRole = "student" | "hr" | "super_admin";

export type User = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  companyId: string | null;
};

export type AnalysisStatus = "new" | "reviewed" | "shortlisted" | "rejected" | "hired";

export type CompanyStatus = "pending" | "approved" | "rejected";

/** Raw shape returned by company-related endpoints (registerCompany,
 * getMyCompany, super-admin list/approve/reject). */
export type CompanySummary = {
  id: string;
  name: string;
  domain: string;
  status: CompanyStatus;
  reviewedBy?: string | null;
  reviewedAt?: string | null;
  createdAt: string;
};

export type SuperAdminRequestStatus = "pending" | "approved" | "rejected";

/** Raw shape returned by super-admin-request endpoints (submitRequest,
 * super_admin list/approve/reject). */
export type SuperAdminRequest = {
  id: string;
  requestedBy: string;
  requestedByName: string | null;
  requestedByEmail: string | null;
  justification: string;
  status: SuperAdminRequestStatus;
  reviewedBy?: string | null;
  reviewedAt?: string | null;
  createdAt: string;
};

export type CompanySubRole = "hr_admin" | "hr_viewer";
export type CompanyMemberStatus = "invited" | "active" | "declined";

/** One row of GET /api/companies/me's team roster. */
export type CompanyMember = {
  id: string;
  userId: string | null;
  name: string | null;
  email: string;
  subRole: CompanySubRole;
  status: CompanyMemberStatus;
  createdAt: string;
};

/** Raw shape returned by POST /api/companies/:id/invite. */
export type InviteResult = {
  id: string;
  email: string;
  subRole: CompanySubRole;
  inviteToken: string;
  inviteUrl: string;
};

/** Raw shape returned by GET /api/companies/invite/:token. */
export type InviteInfo = {
  companyName: string;
  invitedEmail: string;
  subRole: CompanySubRole;
};

/** Raw shape returned by GET /api/invites/me - pending invites addressed to
 * the caller's own account email, for the pending-invite banner. */
export type MyInvite = {
  id: string;
  token: string;
  companyName: string;
  subRole: CompanySubRole;
  createdAt: string;
};

export type PostingSeniority = "internship" | "entry" | "mid" | "senior";
export type PostingStatus = "active" | "closed" | "draft";

/** HR-facing shape returned by POST/GET/PATCH /api/postings. */
export type Posting = {
  _id: string;
  title: string;
  requiredSkills: string[];
  seniority: PostingSeniority;
  jobDescription: string | null;
  companyId: string;
  createdBy: string;
  status: PostingStatus;
  createdAt: string;
};

/** Student-facing shape returned by GET /api/postings/public - companyId is
 * populated down to { _id, name } instead of a bare id string. */
export type PublicPosting = {
  _id: string;
  title: string;
  requiredSkills: string[];
  seniority: PostingSeniority;
  jobDescription: string | null;
  status: PostingStatus;
  companyId: { _id: string; name: string } | null;
  createdAt: string;
};

/** Raw shape returned by GET /api/admin/analyses (hr/super_admin only).
 * Only ever contains analyses the student explicitly applied with. */
export type AdminAnalysisEntry = {
  _id: string;
  userId: { _id: string; name: string; email: string } | string;
  companyId: string | null;
  postingId: { _id: string; title: string } | string | null;
  appliedToCompany: boolean;
  status: AnalysisStatus;
  resumeFilename: string;
  roleId: string;
  roleTitle: string;
  roleLevel: "internship" | "job";
  usedCustomJd: boolean;
  score: ScoreBreakdown;
  matchedSkillCount: number;
  totalRequiredSkillCount: number;
  atsFriendly: boolean;
  createdAt: string;
};

export type Pagination = {
  page: number;
  limit: number;
  total: number;
  pages: number;
};

/** Raw shape returned by GET /api/admin/analyses (paginated). */
export type AdminAnalysesPage = {
  analyses: AdminAnalysisEntry[];
  pagination: Pagination;
};

export type AdminAnalysesFilters = {
  page?: number;
  limit?: number;
  postingId?: string;
  minScore?: number;
  maxScore?: number;
  startDate?: string;
  endDate?: string;
  sortBy?: "date" | "score";
  order?: "asc" | "desc";
};

/** Raw shape returned by GET /api/admin/dashboard-stats (hr/super_admin only). */
export type DashboardStats = {
  totalCandidates: number;
  totalApplications: number;
  averageScore: number;
  scoreTrend: { date: string; averageScore: number; count: number }[];
  postingBreakdown: {
    postingId: string;
    title: string;
    status: PostingStatus | null;
    candidateCount: number;
    averageScore: number;
  }[];
};

export type SkillMatch = {
  skill: string;
  category: "core" | "preferred";
  matched: boolean;
  matchType: "exact" | "fuzzy" | "semantic" | null;
  matchScore: number;
  matchedResumePhrase: string | null;
};

export type AtsIssue = {
  issue: string;
  severity: "high" | "medium" | "low";
  detail: string;
};

export type HiddenTextFinding = {
  method: "docx_vanish" | "near_zero_font_size" | "white_on_white" | "off_page_position" | string;
  detail: string;
  sampleText: string | null;
};

/** Deliberate keyword-concealment signal, kept separate from AtsIssue —
 * this flags gaming the parser, not a formatting quality problem. */
export type HiddenTextWarning = {
  detected: boolean;
  findings: HiddenTextFinding[];
  message: string;
};

export type GithubRepoVerification = {
  url: string;
  owner: string;
  repo: string;
  status: "active" | "stale" | "not_found" | "rate_limited" | "unreachable";
  verified: boolean;
  lastPushedAt: string | null;
  hasReadme: boolean | null;
  sizeKb: number | null;
  stargazersCount: number | null;
  isFork: boolean | null;
  isArchived: boolean | null;
  /** Approximate total commits on the default branch (pagination-header trick). */
  commitCount: number | null;
  /** Root-directory heuristic only - false doesn't prove there are no tests. */
  hasTests: boolean | null;
  /** 0-1 composite of activity/README/tests/commits; only set when verified. Feeds
   * scorer.py's small score bonus/malus (score.adjustments, key "github_authenticity"). */
  authenticityScore: number | null;
  note: string;
};

export type Suggestion = {
  type: "skill_to_learn" | "project_idea" | "resume_rewrite" | "learning_resource";
  text: string;
  priority: "high" | "medium" | "low";
};

export type ScoreComponent = {
  key: "skills" | "projects" | "experience" | "education";
  label: string;
  rawScore: number;
  weight: number;
  weightedPoints: number;
};

export type ScoreAdjustment = {
  key: string;
  label: string;
  kind: "multiplier" | "deduction" | "bonus";
  detail: string;
  multiplier: number | null;
  percentImpact: number | null;
  points: number | null;
};

export type ScoreBreakdown = {
  skillsScore: number;
  projectsScore: number;
  experienceScore: number;
  educationScore: number;
  overallScore: number;
  /** "Why this score?" explanation - present when returned by the current API version. */
  baseScore?: number;
  finalScore?: number;
  components?: ScoreComponent[];
  adjustments?: ScoreAdjustment[];
};

export type AnalysisResult = {
  id: string;
  resumeFilename: string;
  roleId: string;
  roleTitle: string;
  roleLevel: "internship" | "job";
  usedCustomJd: boolean;
  atsFriendly: boolean;
  atsIssues: AtsIssue[];
  hiddenTextWarning: HiddenTextWarning;
  githubVerifications: GithubRepoVerification[];
  score: ScoreBreakdown;
  skillMatches: SkillMatch[];
  matchedSkillCount: number;
  totalRequiredSkillCount: number;
  detectedProjectsCount: number;
  detectedExperienceMonths: number;
  educationDetected: boolean;
  suggestions: Suggestion[];
  companyId: string | null;
  postingId: string | null;
  appliedToCompany: boolean;
  status: AnalysisStatus;
  createdAt: string;
};

export type HistoryEntry = {
  id: string;
  resumeFilename: string;
  roleId: string;
  roleTitle: string;
  roleLevel: "internship" | "job";
  usedCustomJd: boolean;
  score: ScoreBreakdown;
  matchedSkillCount: number;
  totalRequiredSkillCount: number;
  atsFriendly: boolean;
  detectedProjectsCount: number;
  detectedExperienceMonths: number;
  companyId: string | null;
  postingId: string | null;
  appliedToCompany: boolean;
  status: AnalysisStatus;
  createdAt: string;
};

/** One entry in a candidate's score history at this company, for the
 * longitudinal-tracking snippet on the HR candidate-detail page. */
export type ApplicationHistoryEntry = {
  id: string;
  score: number;
  postingTitle: string | null;
  createdAt: string;
  isCurrent: boolean;
};

/** Raw shape returned by GET /api/admin/analyses/:id - same fields as
 * AnalysisResult plus this candidate's score history at this company. */
export type AdminAnalysisDetail = AnalysisResult & {
  applicationHistory: ApplicationHistoryEntry[];
};

/** One flag from the advisory JD-quality checker (see ai-service's jd_quality.py). */
export type JdQualityFlag = {
  flag: string;
  severity: "high" | "medium" | "low";
  detail: string;
};

/** Raw shape returned by POST /api/postings/jd-quality-check. */
export type JdQualityReport = {
  qualityScore: number;
  flags: JdQualityFlag[];
};

/** One row of GET /api/admin/postings/:id/skill-gaps - what % of this
 * posting's candidates are missing a given skill. */
export type SkillGapEntry = {
  skill: string;
  category: "core" | "preferred";
  candidateCount: number;
  failedCount: number;
  failRate: number;
};

/** Raw shape returned by GET /api/admin/postings/:id/skill-gaps. */
export type PostingSkillGaps = {
  postingId: string;
  postingTitle: string;
  totalCandidates: number;
  skillGaps: SkillGapEntry[];
};


