"""
Algorithm A7: Suggestion Generation

Turns the gap between required and matched skills into concrete, prioritized
suggestions across four categories: skills to learn, project ideas, resume
rewrite tips, and curated learning resources.
"""
from typing import List, Optional

from app.data.role_dataset import RoleRequirement
from app.models.schemas import SkillMatch, ATSIssue, ScoreBreakdown, Suggestion, HiddenTextWarning


def build_suggestions(
    role: RoleRequirement,
    skill_matches: List[SkillMatch],
    ats_issues: List[ATSIssue],
    score: ScoreBreakdown,
    detected_projects: int,
    detected_experience_months: int,
    hidden_text_warning: Optional[HiddenTextWarning] = None,
) -> List[Suggestion]:
    suggestions: List[Suggestion] = []

    missing_core = [m for m in skill_matches if not m.matched and m.category == "core"]
    missing_preferred = [m for m in skill_matches if not m.matched and m.category == "preferred"]

    for m in missing_core:
        suggestions.append(Suggestion(
            type="skill_to_learn",
            text=f"Learn/strengthen \"{m.skill}\" — this is a core requirement for {role.title} and wasn't detected in your resume.",
            priority="high",
        ))
    for m in missing_preferred[:5]:  # cap to avoid overwhelming the student
        suggestions.append(Suggestion(
            type="skill_to_learn",
            text=f"Consider adding \"{m.skill}\" — a differentiator for {role.title} candidates.",
            priority="low",
        ))

    if score.projects_score < 100:
        for idea in role.typical_project_ideas[:2]:
            suggestions.append(Suggestion(type="project_idea", text=idea, priority="high" if score.projects_score < 50 else "medium"))

    if score.experience_score < 60 and role.min_experience_months > 0:
        suggestions.append(Suggestion(
            type="resume_rewrite",
            text=(
                f"Your resume shows roughly {detected_experience_months} month(s) of relevant experience against a "
                f"typical {role.min_experience_months}-month bar for this role. If you've done relevant coursework, "
                "freelance, or volunteer work, make sure it's under a clearly labeled 'Experience' section with dates."
            ),
            priority="medium",
        ))

    if score.education_score < 100:
        suggestions.append(Suggestion(
            type="resume_rewrite",
            text=(
                f"Your education section doesn't clearly match expected fields for this role "
                f"({', '.join(role.education_keywords[:3])}...). If relevant, make your degree/major "
                "and institution explicit near the top of the Education section."
            ),
            priority="low",
        ))

    for issue in ats_issues:
        suggestions.append(Suggestion(
            type="resume_rewrite",
            text=f"ATS issue — {issue.issue}: {issue.detail}",
            priority="high" if issue.severity == "high" else "medium",
        ))

    if hidden_text_warning and hidden_text_warning.detected:
        suggestions.append(Suggestion(
            type="resume_rewrite",
            text=(
                f"Hidden/invisible text detected — {hidden_text_warning.message} Remove any white-on-white or "
                "off-screen text; ATS systems and recruiters may flag this as an attempt to game keyword matching."
            ),
            priority="high",
        ))

    if score.skills_score < 70:
        suggestions.append(Suggestion(
            type="learning_resource",
            text=role.learning_resources[0] if role.learning_resources else "Review core role requirements and build a focused project around the top missing skills.",
            priority="medium",
        ))

    # Order: high -> medium -> low
    priority_order = {"high": 0, "medium": 1, "low": 2}
    suggestions.sort(key=lambda s: priority_order.get(s.priority, 3))
    return suggestions

