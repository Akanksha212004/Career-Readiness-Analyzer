"""
Tests for the career-readiness scoring engine fix.

Covers:
1. A resume matching 8/17 skills for "Software Engineering Intern" where the
   2 missing skills are core (python, c++) should land in the amber
   "Getting there" band (~65-68), not the green "Strong fit" band the
   pre-fix formula produced (~83).
2. A resume matching 100% of required skills should still score exactly 100
   (no regression for genuinely complete resumes).
3. The internship experience curve: zero months of experience for an
   internship role should score a 60 baseline, not an automatic 100.
"""
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.data.role_dataset import get_role_by_id
from app.core.scorer import score_resume
from app.models.schemas import SkillMatch


def _matches_for(role, matched_names, all_score=1.0):
    return [
        SkillMatch(
            skill=s.name,
            category=s.category,
            matched=s.name in matched_names,
            match_score=all_score if s.name in matched_names else 0.0,
        )
        for s in role.skills
    ]


def test_missing_core_skills_lands_in_amber_band():
    role = get_role_by_id("sde-intern")
    assert role is not None

    core_names = [s.name for s in role.skills if s.category == "core"]
    preferred_names = [s.name for s in role.skills if s.category == "preferred"]
    assert len(core_names) == 9 and len(role.skills) == 17

    # Match every core skill except python and c++, plus one preferred skill
    # (rest api) -> 8/17 matched overall, 2 missing core skills.
    missing_core = {"python", "c++"}
    matched_core = [n for n in core_names if n not in missing_core]
    matched = set(matched_core) | {preferred_names[0]}
    assert len(matched) == 8

    matches = _matches_for(role, matched)

    # A candidate with ~3 months of relevant experience and a project that
    # clears the bar and a matching education background - i.e. everything
    # *except* the skills gap is solid, so the skills gap is what's being
    # isolated here.
    score = score_resume(
        role=role,
        skill_matches=matches,
        detected_projects=role.min_projects,
        detected_experience_months=3,
        education_detected=True,
    )

    assert 65 <= score.overall_score <= 68, f"expected amber band 65-68, got {score.overall_score}"


def test_full_skill_match_still_scores_100():
    role = get_role_by_id("sde-intern")
    matches = _matches_for(role, {s.name for s in role.skills})

    score = score_resume(
        role=role,
        skill_matches=matches,
        detected_projects=role.min_projects,
        detected_experience_months=3,
        education_detected=True,
    )

    assert score.overall_score == 100.0


def test_internship_zero_experience_uses_baseline_not_automatic_100():
    role = get_role_by_id("sde-intern")
    assert role.min_experience_months == 0

    matches = _matches_for(role, {s.name for s in role.skills})

    score = score_resume(
        role=role,
        skill_matches=matches,
        detected_projects=role.min_projects,
        detected_experience_months=0,
        education_detected=True,
    )

    assert score.experience_score == 60.0


def test_internship_three_months_experience_gets_full_bonus():
    role = get_role_by_id("sde-intern")
    matches = _matches_for(role, {s.name for s in role.skills})

    score = score_resume(
        role=role,
        skill_matches=matches,
        detected_projects=role.min_projects,
        detected_experience_months=3,
        education_detected=True,
    )

    assert score.experience_score == 100.0


def test_job_role_experience_formula_unchanged():
    # Any job-level role (min_experience_months > 0) should keep the plain
    # min(detected/min_required, 1) * 100 formula.
    role = get_role_by_id("sde-intern")
    # Simulate a job-level min_experience_months by constructing manually.
    from app.data.role_dataset import RoleRequirement, RoleLevel

    job_role = role.model_copy(update={"min_experience_months": 12, "level": RoleLevel.JOB})
    matches = _matches_for(job_role, {s.name for s in job_role.skills})

    score = score_resume(
        role=job_role,
        skill_matches=matches,
        detected_projects=job_role.min_projects,
        detected_experience_months=6,
        education_detected=True,
    )

    assert score.experience_score == 50.0  # 6/12 * 100


if __name__ == "__main__":
    test_missing_core_skills_lands_in_amber_band()
    test_full_skill_match_still_scores_100()
    test_internship_zero_experience_uses_baseline_not_automatic_100()
    test_internship_three_months_experience_gets_full_bonus()
    test_job_role_experience_formula_unchanged()
    print("All scorer tests passed.")
