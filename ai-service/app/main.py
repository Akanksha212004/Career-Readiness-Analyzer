from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.routers import analyze, jd_quality

app = FastAPI(
    title="Career Readiness Analyzer - AI Service",
    description="NLP/ML engine: resume parsing, skill matching, ATS checks, and readiness scoring.",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(analyze.router, prefix="/api", tags=["analyze"])
app.include_router(jd_quality.router, prefix="/api", tags=["jd-quality"])


@app.get("/health")
def health_check():
    return {"status": "ok", "service": "ai-service"}


