from typing import List, Optional
from pydantic import BaseModel, Field


class SkillMatch(BaseModel):
    skill: str
    category: str  # "core" | "preferred"
    matched: bool
    match_type: Optional[str] = None  # "exact" | "fuzzy" | "semantic" | None
    match_score: float = 0.0  # 0-1, combined fuzzy+semantic confidence
    matched_resume_phrase: Optional[str] = None


class ATSIssue(BaseModel):
    issue: str
    severity: str  # "high" | "medium" | "low"
    detail: str


class HiddenTextFinding(BaseModel):
    """One specific piece of evidence of concealed/invisible text."""
    method: str  # "white_on_white" | "near_zero_font_size" | "docx_vanish" | "off_page_position"
    detail: str
    sample_text: Optional[str] = None


class HiddenTextWarning(BaseModel):
    """
    Distinct from ATSIssue: this flags deliberate concealment of text used to
    game keyword-matching ATS parsers (invisible-to-humans, visible-to-parser
    keyword stuffing), rather than an ordinary formatting/parsing quality issue.
    """
    detected: bool
    findings: List[HiddenTextFinding] = Field(default_factory=list)
    message: str


class ScoreComponent(BaseModel):
    """One of the four weighted sub-scores that make up the base score."""
    key: str  # "skills" | "projects" | "experience" | "education"
    label: str
    raw_score: float  # 0-100, before weighting
    weight: float  # 0-1, this component's share of the base formula
    weighted_points: float  # raw_score * weight - this component's contribution to base_score


class ScoreAdjustment(BaseModel):
    """A multiplier or flat point adjustment applied to the base score, and why."""
    key: str  # "core_skill_multiplier" | "core_skill_flat_penalty" | "github_authenticity"
    label: str
    kind: str  # "multiplier" | "deduction" | "bonus"
    detail: str  # human-readable reason
    multiplier: Optional[float] = None  # present when kind == "multiplier", e.g. 0.775
    percent_impact: Optional[float] = None  # signed %, e.g. -22.5, present when kind == "multiplier"
    points: Optional[float] = None  # signed points, e.g. -8.0 or +3.5, present when kind in ("deduction", "bonus")


class ScoreBreakdown(BaseModel):
    skills_score: float
    projects_score: float
    experience_score: float
    education_score: float
    overall_score: float  # weighted 0-100

    # Full "why this score" explanation: how base_score was built from the
    # four weighted components, which adjustments were then applied on top
    # (and why), and the resulting final_score (always == overall_score).
    components: List[ScoreComponent] = Field(default_factory=list)
    base_score: float = 0.0
    adjustments: List[ScoreAdjustment] = Field(default_factory=list)
    final_score: float = 0.0


class Suggestion(BaseModel):
    type: str  # "skill_to_learn" | "project_idea" | "resume_rewrite" | "learning_resource"
    text: str
    priority: str  # "high" | "medium" | "low"


class HiddenTextFinding(BaseModel):
    """One concealment technique detected in the uploaded resume file."""
    method: str  # "docx_vanish" | "near_zero_font_size" | "white_on_white" | "off_page_position"
    detail: str
    sample_text: Optional[str] = None  # short, truncated excerpt of the concealed text, if any


class HiddenTextWarning(BaseModel):
    """Result of scanning the resume for hidden/invisible keyword-stuffing.

    Deliberately separate from ATSIssue: this flags an attempt to game the
    parser, not a formatting quality problem, so it's surfaced as its own
    field rather than mixed into `ats_issues`.
    """
    detected: bool
    findings: List[HiddenTextFinding] = Field(default_factory=list)
    message: str


class GithubRepoVerification(BaseModel):
    """Live-verification result for one GitHub repo URL found in the resume.

    We don't just take "has a GitHub link" at face value - we hit the
    GitHub REST API for basic health signals (recent commits, README
    present, rough size, approximate commit count, presence of test files)
    so the UI can show whether the linked project looks like a real,
    maintained thing versus an empty/abandoned repo. `authenticity_score`
    (0-1) rolls those signals into a single number that scorer.py factors
    into a small score bonus/malus (see compute_github_authenticity_adjustment).
    """
    url: str
    owner: str
    repo: str
    # "active" | "stale" | "not_found" | "rate_limited" | "unreachable"
    status: str
    # True only when we actually got live repo data back (active/stale).
    # False for not_found/rate_limited/unreachable, where we simply
    # couldn't confirm anything either way.
    verified: bool
    last_pushed_at: Optional[str] = None  # ISO 8601, from GitHub's `pushed_at`
    has_readme: Optional[bool] = None
    size_kb: Optional[int] = None
    stargazers_count: Optional[int] = None
    is_fork: Optional[bool] = None
    is_archived: Optional[bool] = None
    # Approximate total commit count on the default branch (derived from the
    # GitHub commits-API pagination header, not an exact count for very
    # large repos, but plenty precise for an authenticity signal).
    commit_count: Optional[int] = None
    # Root-directory heuristic: any file/folder that looks test-related
    # (tests/, __tests__/, spec/, *.test.*, etc). A `false` here doesn't
    # prove there are no tests (they could be nested deeper), just that
    # none were visible at the root.
    has_tests: Optional[bool] = None
    # 0-1 composite of the signals above; only set when verified is True
    # (there's nothing to score for a repo we couldn't confirm exists).
    authenticity_score: Optional[float] = None
    note: str  # short human-readable summary, e.g. "✓ Active repo, last updated 2 weeks ago"


class AnalyzeResponse(BaseModel):
    role_id: str
    role_title: str
    role_level: str
    used_custom_jd: bool
    ats_friendly: bool
    ats_issues: List[ATSIssue]
    hidden_text_warning: HiddenTextWarning
    github_verifications: List[GithubRepoVerification] = Field(default_factory=list)
    score: ScoreBreakdown
    skill_matches: List[SkillMatch]
    matched_skill_count: int
    total_required_skill_count: int
    detected_projects_count: int
    detected_experience_months: int
    education_detected: bool
    suggestions: List[Suggestion]
    extracted_text_preview: str = Field(
        ..., description="First ~500 chars of cleaned resume text, for debugging/UI preview"
    )


class RoleListItem(BaseModel):
    role_id: str
    title: str
    level: str


class JdQualityFlag(BaseModel):
    """One issue found in a job-description quality check (see jd_quality.py)."""
    flag: str  # e.g. "unrealistic_experience_requirement" | "vague_skill_requirements" | "gendered_language_masculine"
    severity: str  # "high" | "medium" | "low"
    detail: str


class JdQualityReport(BaseModel):
    """Advisory JD-quality result for the HR posting-creation form. Never
    blocks posting creation - see postingController.js on the Node side."""
    quality_score: int  # 0-100, 100 = no flags found
    flags: List[JdQualityFlag] = Field(default_factory=list)


class JdQualityRequest(BaseModel):
    job_description: str
    seniority: Optional[str] = None  # "internship" | "entry" | "mid" | "senior"



