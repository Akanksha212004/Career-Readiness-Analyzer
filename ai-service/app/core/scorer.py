"""
Algorithm A6: Weighted Career Readiness Score
base_overall = 0.40*S + 0.25*P + 0.20*E + 0.15*Ed   (normalized to 0-100)
overall = clamp(base_overall * core_multiplier - flat_core_penalty, 0, 100)

- S (Skills): weighted proportion of required skills matched, weighted by
  each skill's `weight` within the role, with core-skill misses penalized
  more than preferred-skill misses (core skills contribute more of the bucket).
- P (Projects): detected project count vs. the role's min_projects expectation,
  saturating at 100 once the bar is met/exceeded (more isn't linearly "better"
  past a point - depth matters more than count, which we can't measure here).
- E (Experience): for internship roles (min_experience_months == 0),
  experience genuinely isn't required, so we use a graduated baseline+bonus
  curve (60 baseline + up to 40 bonus for real months of experience) rather
  than an automatic 100 - a thin resume shouldn't get a full mark here just
  because the role doesn't strictly require experience. Job-level roles keep
  the original min(detected/min_required, 1) * 100 formula.
- Ed (Education): whether education-section keywords match the role's expected field.
- Core-skill gate: the weighted skills score above can still be inflated by
  a handful of well-matched preferred skills even when several *core*
  (must-have) skills are completely missing. To stop a resume that's
  missing multiple core skills from landing in the "Strong fit" band, we
  apply a multiplicative penalty based on core-skill coverage plus a flat
  per-missing-core-skill deduction, on top of the base weighted score.
"""
from typing import List, Optional

from app.data.role_dataset import RoleRequirement
from app.models.schemas import SkillMatch, ScoreBreakdown, ScoreComponent, ScoreAdjustment, GithubRepoVerification

# Internship experience curve constants (see module docstring).
INTERNSHIP_EXPERIENCE_BASELINE = 60.0
INTERNSHIP_EXPERIENCE_MAX_BONUS = 40.0
INTERNSHIP_EXPERIENCE_MONTHS_FOR_FULL_BONUS = 3.0

# Core-skill gate constants (see module docstring).
CORE_MULTIPLIER_FLOOR = 0.55
CORE_MULTIPLIER_COVERAGE_WEIGHT = 0.45
CORE_PENALTY_PER_MISSING_SKILL = 4.0
CORE_PENALTY_MAX = 20.0

# GitHub-authenticity adjustment constants (see compute_github_authenticity_adjustment).
# Deliberately small relative to the 100-point scale and the core-skill gate
# above - this is a supporting signal (does the candidate's claimed project
# work look real?), not a new pillar of the score, so it never overrides the
# existing 40/25/20/15 weighting.
GITHUB_AUTHENTICITY_MAX_POINTS = 5.0
GITHUB_AUTHENTICITY_MIN_POINTS_TO_SURFACE = 0.5

# Component weights in the base formula (see module docstring formula).
SKILLS_WEIGHT = 0.40
PROJECTS_WEIGHT = 0.25
EXPERIENCE_WEIGHT = 0.20
EDUCATION_WEIGHT = 0.15


def compute_github_authenticity_adjustment(
    github_verifications: Optional[List[GithubRepoVerification]],
) -> Optional[ScoreAdjustment]:
    """A small bonus/malus (capped at +/-GITHUB_AUTHENTICITY_MAX_POINTS) based
    on how "real" the candidate's linked GitHub projects look - commit
    activity, README presence, and test coverage (see github_verifier.py's
    per-repo authenticity_score). Only considers repos we could actually
    verify; a resume with no GitHub links, or only unverifiable/not-found
    ones, gets no adjustment either way (absence of evidence isn't evidence
    of absence - we simply can't assess what we can't see).
    """
    if not github_verifications:
        return None

    scored = [v.authenticity_score for v in github_verifications if v.verified and v.authenticity_score is not None]
    if not scored:
        return None

    avg_authenticity = sum(scored) / len(scored)
    # avg_authenticity is 0-1 with 0.5 as the neutral midpoint; map linearly
    # to a +/-GITHUB_AUTHENTICITY_MAX_POINTS point adjustment.
    points = round((avg_authenticity - 0.5) * 2 * GITHUB_AUTHENTICITY_MAX_POINTS, 1)

    if abs(points) < GITHUB_AUTHENTICITY_MIN_POINTS_TO_SURFACE:
        return None

    repo_count = len(scored)
    repo_word = "project" if repo_count == 1 else "projects"

    if points > 0:
        return ScoreAdjustment(
            key="github_authenticity",
            label="GitHub project authenticity",
            kind="bonus",
            detail=(
                f"{repo_count} linked GitHub {repo_word} checked for commit activity, README, and "
                f"test coverage - average authenticity signal {avg_authenticity * 100:.0f}%. A small "
                "bonus for projects that look genuinely active and maintained."
            ),
            points=points,
        )

    return ScoreAdjustment(
        key="github_authenticity",
        label="GitHub project authenticity concerns",
        kind="deduction",
        detail=(
            f"{repo_count} linked GitHub {repo_word} checked for commit activity, README, and test "
            f"coverage - average authenticity signal only {avg_authenticity * 100:.0f}%. Linked "
            "projects look sparse (few commits, no README/tests, or stale/archived), so a small "
            "deduction is applied."
        ),
        points=points,
    )


def score_resume(
    role: RoleRequirement,
    skill_matches: List[SkillMatch],
    detected_projects: int,
    detected_experience_months: int,
    education_detected: bool,
    github_verifications: Optional[List[GithubRepoVerification]] = None,
) -> ScoreBreakdown:
    # --- Skills (40%) ---
    weight_by_name = {s.name: s.weight for s in role.skills}
    total_weight = sum(weight_by_name.values()) or 1.0
    earned = 0.0
    for m in skill_matches:
        w = weight_by_name.get(m.skill, 0.0)
        if m.matched:
            # match_score already reflects match confidence (exact ~1.0,
            # fuzzy/semantic hits scaled down accordingly) - use it directly
            earned += w * m.match_score
    skills_score = round(min(earned / total_weight, 1.0) * 100, 1)

    # --- Projects (25%) ---
    if role.min_projects <= 0:
        projects_score = 100.0
    else:
        projects_score = round(min(detected_projects / role.min_projects, 1.0) * 100, 1)

    # --- Experience (20%) ---
    if role.min_experience_months <= 0:
        # Internship role: experience isn't required, but we shouldn't hand
        # out a free 100. Baseline reflects "not required", bonus rewards
        # any real experience the candidate does have.
        bonus = min(detected_experience_months / INTERNSHIP_EXPERIENCE_MONTHS_FOR_FULL_BONUS, 1.0) * (
            INTERNSHIP_EXPERIENCE_MAX_BONUS
        )
        experience_score = round(
            min(INTERNSHIP_EXPERIENCE_BASELINE + bonus, 100.0), 1
        )
    else:
        experience_score = round(min(detected_experience_months / role.min_experience_months, 1.0) * 100, 1)

    # --- Education (15%) ---
    education_score = 100.0 if education_detected else 30.0  # not zero: many strong candidates have adjacent/self-taught backgrounds

    base_overall = (
        SKILLS_WEIGHT * skills_score
        + PROJECTS_WEIGHT * projects_score
        + EXPERIENCE_WEIGHT * experience_score
        + EDUCATION_WEIGHT * education_score
    )

    components = [
        ScoreComponent(
            key="skills", label="Skills", raw_score=skills_score, weight=SKILLS_WEIGHT,
            weighted_points=round(SKILLS_WEIGHT * skills_score, 2),
        ),
        ScoreComponent(
            key="projects", label="Projects", raw_score=projects_score, weight=PROJECTS_WEIGHT,
            weighted_points=round(PROJECTS_WEIGHT * projects_score, 2),
        ),
        ScoreComponent(
            key="experience", label="Experience", raw_score=experience_score, weight=EXPERIENCE_WEIGHT,
            weighted_points=round(EXPERIENCE_WEIGHT * experience_score, 2),
        ),
        ScoreComponent(
            key="education", label="Education", raw_score=education_score, weight=EDUCATION_WEIGHT,
            weighted_points=round(EDUCATION_WEIGHT * education_score, 2),
        ),
    ]
    base_score = round(base_overall, 1)

    # --- Core-skill gate ---
    core_matches = [m for m in skill_matches if m.category == "core"]
    total_core = len(core_matches)
    matched_core = sum(1 for m in core_matches if m.matched)
    missing_core = total_core - matched_core

    if total_core > 0:
        core_coverage = matched_core / total_core
    else:
        # No core skills defined for this role: don't penalize.
        core_coverage = 1.0

    core_multiplier = CORE_MULTIPLIER_FLOOR + CORE_MULTIPLIER_COVERAGE_WEIGHT * core_coverage
    flat_core_penalty = min(missing_core * CORE_PENALTY_PER_MISSING_SKILL, CORE_PENALTY_MAX)

    github_adjustment = compute_github_authenticity_adjustment(github_verifications)
    github_points = github_adjustment.points if github_adjustment else 0.0

    overall = base_overall * core_multiplier - flat_core_penalty + github_points
    overall = max(0.0, min(100.0, overall))
    final_score = round(overall, 1)

    adjustments: List[ScoreAdjustment] = []
    if total_core > 0:
        if missing_core > 0:
            multiplier_detail = (
                f"{matched_core}/{total_core} core skills matched ({missing_core} missing) - core-skill "
                f"coverage scales the base score by {core_multiplier:.2f}x so a resume can't reach a "
                f"high score on strong preferred-skill matches alone while missing must-have skills."
            )
        else:
            multiplier_detail = (
                f"All {total_core} core skills matched - full core-skill multiplier applied "
                f"({core_multiplier:.2f}x, the maximum for this gate)."
            )
        adjustments.append(ScoreAdjustment(
            key="core_skill_multiplier",
            label="Core-skill coverage multiplier",
            kind="multiplier",
            detail=multiplier_detail,
            multiplier=round(core_multiplier, 3),
            percent_impact=round((core_multiplier - 1.0) * 100, 1),
        ))

        if flat_core_penalty > 0:
            capped_note = " (capped)" if missing_core * CORE_PENALTY_PER_MISSING_SKILL > CORE_PENALTY_MAX else ""
            adjustments.append(ScoreAdjustment(
                key="core_skill_flat_penalty",
                label=f"Core skills missing ({missing_core})",
                kind="deduction",
                detail=(
                    f"{missing_core} core skill(s) missing x {CORE_PENALTY_PER_MISSING_SKILL:.0f} pts each"
                    f"{capped_note} - a flat penalty on top of the multiplier above, since missing "
                    f"must-have skills should cost points beyond just diluting the weighted average."
                ),
                points=-round(flat_core_penalty, 1),
            ))

    if github_adjustment:
        adjustments.append(github_adjustment)

    return ScoreBreakdown(
        skills_score=skills_score,
        projects_score=projects_score,
        experience_score=experience_score,
        education_score=education_score,
        overall_score=final_score,
        components=components,
        base_score=base_score,
        adjustments=adjustments,
        final_score=final_score,
    )


def detect_education_match(education_text: str, keywords: List[str]) -> bool:
    lower = education_text.lower()
    return any(k in lower for k in keywords)


