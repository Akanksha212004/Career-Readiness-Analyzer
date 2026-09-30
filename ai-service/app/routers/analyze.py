from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from typing import Optional

from app.data.role_dataset import get_role_by_id, list_roles, RoleRequirement, SkillRequirement, RoleLevel
from app.core.text_extraction import extract_text, UnsupportedFileTypeError, EmptyResumeError
from app.core.preprocessing import tokenize_and_lemmatize, segment_sections, estimate_experience_months, count_projects
from app.core.ats_checker import run_ats_check
from app.core.hidden_text_detector import detect_hidden_text
from app.core.github_verifier import verify_github_links
from app.core.skill_matcher import match_skills
from app.core.jd_comparator import extract_jd_terms, jd_terms_to_skill_requirements, compute_resume_jd_similarity
from app.core.scorer import score_resume, detect_education_match
from app.core.suggestions import build_suggestions
from app.models.schemas import AnalyzeResponse, RoleListItem

router = APIRouter()


@router.get("/roles", response_model=list[RoleListItem])
def get_roles():
    return list_roles()


@router.post("/analyze", response_model=AnalyzeResponse)
async def analyze_resume(
    file: UploadFile = File(...),
    role_id: Optional[str] = Form(None),
    job_description: Optional[str] = Form(None),
):
    if not role_id and not job_description:
        raise HTTPException(status_code=400, detail="Provide either role_id or job_description.")

    file_bytes = await file.read()
    if not file_bytes:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")

    try:
        resume_text = extract_text(file.filename, file_bytes)
    except UnsupportedFileTypeError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except EmptyResumeError as e:
        raise HTTPException(status_code=422, detail=str(e))

    tokens = tokenize_and_lemmatize(resume_text)
    sections = segment_sections(resume_text)

    detected_projects = count_projects(sections.get("projects", ""))
    detected_experience_months = estimate_experience_months(sections.get("experience", ""))

    used_custom_jd = bool(job_description and job_description.strip())

    if used_custom_jd:
        jd_terms = extract_jd_terms(job_description)
        skill_requirements = jd_terms_to_skill_requirements(jd_terms)
        role = RoleRequirement(
            role_id="custom-jd",
            title="Custom Job Description",
            level=RoleLevel.JOB,
            description="Ad-hoc role derived from a pasted job description.",
            skills=skill_requirements,
            min_projects=2,
            min_experience_months=6,
            education_keywords=["bachelor", "b.tech", "degree"],
            typical_project_ideas=[
                "Build a project that directly exercises the top 2-3 extracted JD terms end-to-end.",
            ],
            learning_resources=[],
        )
        jd_similarity = compute_resume_jd_similarity(resume_text, job_description)
    else:
        role = get_role_by_id(role_id)
        if role is None:
            raise HTTPException(status_code=404, detail=f"Unknown role_id '{role_id}'.")
        jd_similarity = None

    skill_matches = match_skills(role.skills, resume_text, tokens)
    education_detected = detect_education_match(sections.get("education", ""), role.education_keywords)

    ats_issues = run_ats_check(file.filename, file_bytes, sections)

    # Separate from ats_issues on purpose: this is a deliberate-concealment
    # signal (keyword stuffing hidden from human reviewers), not a formatting
    # quality issue, so it gets its own field in the response.
    hidden_text_warning = detect_hidden_text(file.filename, file_bytes)

    # Verify any GitHub project links against the live GitHub API instead of
    # trusting "has a link" at face value. Network-bound and best-effort -
    # failures degrade to a per-link status (see github_verifier.py) rather
    # than ever breaking the rest of the analysis.
    github_verifications = await verify_github_links(resume_text)

    score = score_resume(
        role=role,
        skill_matches=skill_matches,
        detected_projects=detected_projects,
        detected_experience_months=detected_experience_months,
        education_detected=education_detected,
        github_verifications=github_verifications,
    )

    suggestions = build_suggestions(
        role=role,
        skill_matches=skill_matches,
        ats_issues=ats_issues,
        score=score,
        detected_projects=detected_projects,
        detected_experience_months=detected_experience_months,
        hidden_text_warning=hidden_text_warning,
    )

    matched_count = sum(1 for m in skill_matches if m.matched)

    return AnalyzeResponse(
        role_id=role.role_id,
        role_title=role.title,
        role_level=role.level.value,
        used_custom_jd=used_custom_jd,
        ats_friendly=len([i for i in ats_issues if i.severity == "high"]) == 0,
        ats_issues=ats_issues,
        hidden_text_warning=hidden_text_warning,
        github_verifications=github_verifications,
        score=score,
        skill_matches=skill_matches,
        matched_skill_count=matched_count,
        total_required_skill_count=len(skill_matches),
        detected_projects_count=detected_projects,
        detected_experience_months=detected_experience_months,
        education_detected=education_detected,
        suggestions=suggestions,
        extracted_text_preview=resume_text[:500],
    )


