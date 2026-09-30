from fastapi import APIRouter

from app.core.jd_quality import analyze_jd_quality
from app.models.schemas import JdQualityRequest, JdQualityReport

router = APIRouter()


@router.post("/jd-quality", response_model=JdQualityReport)
def check_jd_quality(payload: JdQualityRequest):
    """Advisory-only JD quality check for the HR posting create/edit form
    (see postingController.js on the Node side, which calls this and
    surfaces the result but never blocks saving on it)."""
    return analyze_jd_quality(payload.job_description, payload.seniority)
