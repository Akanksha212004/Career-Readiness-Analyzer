import os
import re
import math
import tempfile
import pdfplumber
from docx import Document
from fastapi import FastAPI, File, UploadFile, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
import uvicorn
import json
from datetime import datetime
from dotenv import load_dotenv
from groq import Groq

# ── NLP / ML Imports ──────────────────────────────────────────────
import spacy
from sentence_transformers import SentenceTransformer, util
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity as sk_cosine
import numpy as np

load_dotenv()
groq_client = Groq(api_key=os.getenv("GROQ_API_KEY"))

# ══════════════════════════════════════════════════════════════════
# MODEL LOADING
# ══════════════════════════════════════════════════════════════════
print("Loading models...")
nlp_model = spacy.load("en_core_web_md")
embedder = SentenceTransformer("all-MiniLM-L6-v2")
print("All models loaded successfully!")

app = FastAPI(title="Career Readiness ML Service — Deep Search Edition")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ══════════════════════════════════════════════════════════════════
# ROLE KNOWLEDGE BASE
# ══════════════════════════════════════════════════════════════════
ROLE_DB = {
    "frontend": {
        "required": ["html", "css", "javascript", "typescript", "react", "next.js", "redux", "tailwind", "figma"],
        "bonus":    ["framer motion", "webpack", "vite", "storybook", "cypress", "seo", "web vitals", "a11y"],
        "jd_text":  "Frontend developer skilled in React, Next.js, and modern UI/UX tools.",
        "courses": [
            {"title": "React - The Complete Guide",      "platform": "Udemy",    "link": "#", "duration": "40h"},
            {"title": "Next.js 14 & React",              "platform": "Udemy",    "link": "#", "duration": "25h"},
            {"title": "TypeScript Bootcamp",             "platform": "Coursera", "link": "#", "duration": "20h"},
        ],
        "jobs": [
            {"role": "Frontend Intern",    "company": "Google",  "location": "Remote",  "apply_link": "#"},
            {"role": "React Developer",    "company": "Meta",    "location": "Hybrid",  "apply_link": "#"},
            {"role": "UI Engineer Intern", "company": "Atlassian","location": "Remote", "apply_link": "#"},
        ],
        "suggestions":       ["Master TypeScript generics and advanced types",
                               "Deep dive into Web Core Vitals & SEO optimisation",
                               "Learn Framer Motion for production-grade animations",
                               "Write unit & integration tests with Jest + React Testing Library"],
        "projects":          ["Portfolio with Framer Motion animations",
                               "E-commerce dashboard with real-time updates",
                               "Component library published on npm"],
        "project_signals":   ["react", "ui", "frontend", "next", "css"],
    },
    "backend": {
        "required": ["python", "node.js", "sql", "mongodb", "docker", "aws", "fastapi", "django", "express"],
        "bonus":    ["redis", "kafka", "grpc", "microservices", "kubernetes", "ci/cd", "terraform", "rabbitmq"],
        "jd_text":  "Backend engineer specialising in scalable APIs and database management.",
        "courses": [
            {"title": "Node.js Masterclass",             "platform": "Udemy",    "link": "#", "duration": "35h"},
            {"title": "System Design for Interviews",    "platform": "Educative","link": "#", "duration": "30h"},
            {"title": "Docker & Kubernetes Bootcamp",    "platform": "Udemy",    "link": "#", "duration": "22h"},
        ],
        "jobs": [
            {"role": "Backend Intern",     "company": "Amazon",   "location": "Seattle", "apply_link": "#"},
            {"role": "Node.js Developer",  "company": "Flipkart", "location": "Bangalore","apply_link": "#"},
        ],
        "suggestions":       ["Learn System Design (HLD + LLD)",
                               "Dockerise all your projects and push to Docker Hub",
                               "Build a production-ready REST API with rate-limiting & auth",
                               "Explore Redis caching & message queues"],
        "projects":          ["REST API with JWT + role-based access control",
                               "Microservices e-commerce backend with Docker",
                               "Real-time notification system with WebSockets"],
        "project_signals":   ["api", "database", "backend", "server", "express"],
    },
    "fullstack": {
        "required": ["html", "css", "javascript", "react", "node.js", "mongodb", "next.js",
                     "postgresql", "express", "rest api"],
        "bonus":    ["typescript", "docker", "aws", "redis", "graphql", "testing", "ci/cd"],
        "jd_text":  "Full stack developer capable of handling both client-side and server-side logic.",
        "courses": [
            {"title": "MERN Stack Bootcamp",             "platform": "Udemy",    "link": "#", "duration": "50h"},
            {"title": "Full Stack Open (Helsinki)",      "platform": "Free",     "link": "https://fullstackopen.com", "duration": "self-paced"},
            {"title": "System Design Primer",            "platform": "GitHub",   "link": "#", "duration": "self-paced"},
        ],
        "jobs": [
            {"role": "Full Stack Intern",     "company": "Atlassian", "location": "Remote",    "apply_link": "#"},
            {"role": "Full Stack Developer",  "company": "Shopify",   "location": "Remote",    "apply_link": "#"},
            {"role": "SDE Intern",            "company": "Swiggy",    "location": "Bangalore", "apply_link": "#"},
        ],
        "suggestions":       ["Build and deploy an end-to-end application on Vercel + Render",
                               "Learn CI/CD with GitHub Actions",
                               "Add TypeScript to your existing JS projects",
                               "Study Low-Level Design patterns"],
        "projects":          ["Social Media App with MERN (real-time chat + feed)",
                               "Full-stack e-commerce platform with Stripe payments",
                               "Real-time collaborative tool (like Notion/Figma lite)"],
        "project_signals":   ["fullstack", "mern", "nextjs", "vercel", "render"],
    },
    "data": {
        "required": ["python", "pandas", "numpy", "sql", "machine learning", "scikit-learn",
                     "matplotlib", "tableau", "statistics"],
        "bonus":    ["tensorflow", "pytorch", "spark", "airflow", "dbt", "bigquery", "kafka"],
        "jd_text":  "Data scientist / analyst with strong ML and analytical skills.",
        "courses": [
            {"title": "Machine Learning by Andrew Ng",  "platform": "Coursera", "link": "#", "duration": "60h"},
            {"title": "Python for Data Science",        "platform": "DataCamp", "link": "#", "duration": "30h"},
        ],
        "jobs": [
            {"role": "Data Analyst Intern",    "company": "Walmart Labs", "location": "Remote",    "apply_link": "#"},
            {"role": "ML Engineer Intern",     "company": "NVIDIA",       "location": "Hybrid",    "apply_link": "#"},
        ],
        "suggestions":       ["Complete a Kaggle competition end-to-end",
                               "Learn SQL window functions and query optimisation",
                               "Build an ML pipeline with MLflow"],
        "projects":          ["End-to-end ML pipeline on Kaggle dataset",
                               "Sentiment analysis web app", "Sales prediction dashboard"],
        "project_signals":   ["data", "ml", "model", "analysis", "kaggle"],
    },
    "devops": {
        "required": ["docker", "kubernetes", "aws", "ci/cd", "linux", "terraform",
                     "ansible", "jenkins", "github actions"],
        "bonus":    ["helm", "prometheus", "grafana", "elk stack", "vault", "istio"],
        "jd_text":  "DevOps engineer skilled in cloud infrastructure and automation.",
        "courses": [
            {"title": "AWS Certified Solutions Architect", "platform": "A Cloud Guru", "link": "#", "duration": "40h"},
            {"title": "Docker & Kubernetes Complete Guide", "platform": "Udemy",       "link": "#", "duration": "22h"},
        ],
        "jobs": [
            {"role": "DevOps Intern",     "company": "Infosys",  "location": "Pune",   "apply_link": "#"},
            {"role": "Cloud Intern",      "company": "TCS",      "location": "Remote", "apply_link": "#"},
        ],
        "suggestions":       ["Get AWS Cloud Practitioner certified",
                               "Set up a full CI/CD pipeline with GitHub Actions",
                               "Deploy a Kubernetes cluster locally with Minikube"],
        "projects":          ["CI/CD pipeline for a MERN app",
                               "Dockerised microservices with Kubernetes orchestration",
                               "Infrastructure-as-Code with Terraform on AWS"],
        "project_signals":   ["docker", "aws", "kubernetes", "cloud", "devops"],
    },
}

# ══════════════════════════════════════════════════════════════════
# SKILL SYNONYM MAP — maps resume keywords → canonical skill names
# ══════════════════════════════════════════════════════════════════
SKILL_SYNONYMS = {
    "reactjs": "react", "react.js": "react",
    "nextjs": "next.js", "next js": "next.js",
    "nodejs": "node.js", "node js": "node.js",
    "expressjs": "express", "express.js": "express",
    "mongo": "mongodb", "mongo db": "mongodb",
    "postgres": "postgresql", "pg": "postgresql",
    "js": "javascript", "ts": "typescript",
    "scss": "css", "sass": "css", "tailwindcss": "tailwind",
    "aws lambda": "aws", "ec2": "aws", "s3": "aws",
    "scikit learn": "scikit-learn", "sklearn": "scikit-learn",
    "ml": "machine learning", "ai": "machine learning",
    "ds": "data structures", "dsa": "data structures",
    "rest": "rest api", "restful": "rest api",
    "jwt": "authentication", "oauth": "authentication",
    "redux toolkit": "redux",
}

# ── Company Tier System ───────────────────────────────────────────
# TIER S  : Global FAANG / top product companies — highest prestige
TIERS_BRANDS = [
    "google", "microsoft", "meta", "apple", "amazon", "netflix",
    "uber", "stripe", "spotify", "openai", "deepmind",
    # NOTE: "airbnb" intentionally excluded — used as project clone name in many resumes
]
# TIER 1A : Strong Indian unicorns + top global product companies
TIER1A_BRANDS = [
    "flipkart", "razorpay", "meesho", "cred", "zepto", "groww",
    "phonepe", "paytm", "zomato", "swiggy", "ola", "nykaa",
    "atlassian", "adobe", "salesforce", "linkedin", "twitter",
    "oracle", "nvidia", "qualcomm", "intuit", "workday",
]
# TIER 1B : Reputed startups / product companies — decent signal
TIER1B_BRANDS = [
    "scaler", "interviewbit", "byjus", "unacademy", "vedantu",
    "freshworks", "zoho", "browserstack", "postman", "hasura",
    "chargebee", "setu", "slice", "smallcase", "cleartax",
]
# TIER 2  : Service / consulting companies — lower signal
TIER2_BRANDS = [
    "infosys", "tcs", "wipro", "hcl", "cognizant", "accenture",
    "capgemini", "mphasis", "tech mahindra", "mindtree", "ltimindtree",
    "hexaware", "mphasis", "persistent", "cyient",
]
# TIER 3  : Bootcamps / low-signal internship providers
TIER3_BRANDS = [
    "nullclass", "internshala", "codeclause", "coincent", "teckzite",
    "besant", "simplilearn", "edureka",
]

# Flat list for backward-compat checks (union of S + 1A + 1B)
TIER1_BRANDS = TIERS_BRANDS + TIER1A_BRANDS + TIER1B_BRANDS

# Score awarded per tier when company is found in resume
TIER_SCORE_MAP = {
    "S":  45,   # FAANG — massive signal
    "1A": 35,   # Indian unicorn / top global product
    "1B": 25,   # Reputed startup / EdTech product
    "2":  15,   # IT services
    "3":   8,   # Bootcamp / low-signal
    "unknown": 5,
}

# How much experience_score weight grows when strong company is present
# Used in overall score formula (dynamic weight)
TIER_EXP_WEIGHT_BOOST = {
    "S":  0.10,   # adds +10% to experience weight in overall
    "1A": 0.07,
    "1B": 0.04,
    "2":  0.02,
    "3":  0.00,
    "unknown": 0.00,
}

# ══════════════════════════════════════════════════════════════════
# DEEP SEARCH SUGGESTIONS
# ══════════════════════════════════════════════════════════════════
@app.get("/roles/suggest")
def suggest_roles(q: str = ""):
    query = q.lower().strip()
    if not query:
        return []
    results = set()
    for key, data in ROLE_DB.items():
        if query in key.lower():
            results.add(key.title())
        for job in data.get("jobs", []):
            job_title = job.get("role", "")
            if query in job_title.lower():
                results.add(job_title)
        for project in data.get("projects", []):
            if query in project.lower():
                results.add(project)
    return sorted(list(results), key=len)[:10]


# ══════════════════════════════════════════════════════════════════
# HELPER UTILITIES
# ══════════════════════════════════════════════════════════════════

def clamp(n: float, lo=0, hi=100) -> int:
    return int(min(hi, max(lo, round(n))))


def detect_company_tier(text_lower: str) -> tuple[str, list[str]]:
    """
    Scans ONLY the experience/work section of the resume (not projects)
    to avoid false positives like "Airbnb Clone" being treated as
    actual Airbnb work experience.

    Returns: (best_tier: str, matched_companies: list[str])
    Tier order: S > 1A > 1B > 2 > 3 > unknown
    """
    # ── Extract only the experience section ──────────────────────
    # Split on common section headers and take only the experience chunk
    exp_section = text_lower

    # Find the start of experience section
    # Longer/more-specific patterns first to avoid false matches
    # e.g. "experience" alone can appear in "Computer Science and Engineering"
    exp_start_patterns = [
        "work experience", "employment history", "employment",
        "internship experience", "internship",
        "professional experience", "experience"
    ]
    # Find the end of experience section (next section header)
    next_section_patterns = [
        "project", "education", "skill", "achievement",
        "certification", "award", "publication", "volunteer",
        "position", "extra", "activity", "language"
    ]

    start_idx = -1
    # Search for each pattern as a standalone section header (preceded by newline or start)
    for pat in exp_start_patterns:
        # Match pattern only when it appears at start of a line (section header context)
        for m in re.finditer(r'(?:^|\n)\s*' + re.escape(pat) + r'\s*(?:\n|$)', text_lower):
            candidate = m.start()
            if start_idx == -1 or candidate < start_idx:
                start_idx = candidate
        if start_idx != -1:
            break

    # Fallback: plain find if regex found nothing
    if start_idx == -1:
        for pat in exp_start_patterns:
            idx = text_lower.find(pat)
            if idx != -1:
                start_idx = idx
                break

    if start_idx != -1:
        # Find earliest next-section boundary after experience starts
        end_idx = len(text_lower)
        for pat in next_section_patterns:
            # Also match next-section headers as line-start patterns
            for m in re.finditer(r'(?:^|\n)\s*' + re.escape(pat) + r'\s*(?:\n|$|s\b)', text_lower):
                idx = m.start()
                if idx > start_idx + 20 and idx < end_idx:
                    end_idx = idx
        # Fallback plain find
        if end_idx == len(text_lower):
            for pat in next_section_patterns:
                idx = text_lower.find(pat, start_idx + 20)
                if idx != -1 and idx < end_idx:
                    end_idx = idx
        exp_section = text_lower[start_idx:end_idx]

    # ── Now scan only exp_section for company names ───────────────
    tier_priority = ["S", "1A", "1B", "2", "3"]
    tier_map = {
        "S":  TIERS_BRANDS,
        "1A": TIER1A_BRANDS,
        "1B": TIER1B_BRANDS,
        "2":  TIER2_BRANDS,
        "3":  TIER3_BRANDS,
    }

    best_tier   = "unknown"
    all_matched = []

    for tier in tier_priority:
        matched = [b for b in tier_map[tier] if b in exp_section]
        if matched:
            all_matched.extend(matched)
            if best_tier == "unknown":
                best_tier = tier

    return best_tier, list(set(all_matched))

def normalise_skill(s: str) -> str:
    s = s.lower().strip()
    return SKILL_SYNONYMS.get(s, s)

def extract_skills_from_text(text: str) -> list[str]:
    """
    Extract all skills / tech terms from free-form resume text.
    Returns a deduplicated, normalised list.
    """
    text_lower = text.lower()

    # Master skill vocabulary (union of all role skills + common ones)
    all_known_skills = set()
    for rd in ROLE_DB.values():
        all_known_skills.update(rd["required"])
        all_known_skills.update(rd.get("bonus", []))

    extra_skills = [
        "git", "github", "jira", "postman", "vs code", "intellij", "linux",
        "bash", "figma", "vercel", "render", "heroku", "firebase",
        "java", "c++", "c", "python", "ruby", "go", "rust", "kotlin", "swift",
        "jwt", "oauth", "graphql", "rest api", "websockets", "socket.io",
        "bootstrap", "material ui", "shadcn", "framer motion",
        "jest", "vitest", "playwright", "cypress", "mocha",
        "redux toolkit", "zustand", "react query", "swr",
        "prisma", "mongoose", "sequelize", "typeorm",
        "stripe", "razorpay", "cloudinary", "bcrypt",
        "data structures", "algorithms", "system design",
        "oops", "dbms", "os", "computer networks",
    ]
    all_known_skills.update(extra_skills)

    # Multi-word skills first, then single-word
    found = set()
    sorted_skills = sorted(all_known_skills, key=len, reverse=True)
    for skill in sorted_skills:
        pattern = r'\b' + re.escape(skill) + r'\b'
        if re.search(pattern, text_lower):
            found.add(normalise_skill(skill))

    # Also check synonym map
    for alias, canonical in SKILL_SYNONYMS.items():
        pattern = r'\b' + re.escape(alias) + r'\b'
        if re.search(pattern, text_lower):
            found.add(canonical)

    return sorted(found)


def detect_role_key(role: str) -> str:
    r = role.lower()
    if any(k in r for k in ["data", "ml", "machine learning", "analyst", "science"]):
        return "data"
    if any(k in r for k in ["devops", "cloud", "infra", "sre", "platform"]):
        return "devops"
    if any(k in r for k in ["fullstack", "full stack", "mern", "full-stack"]):
        return "fullstack"
    if any(k in r for k in ["backend", "node", "api", "server", "django", "fastapi"]):
        return "backend"
    if any(k in r for k in ["frontend", "react", "ui", "angular", "vue"]):
        return "frontend"
    return "fullstack"


def compute_skill_scores(text: str, rd: dict) -> dict:
    """
    Returns:
      skill_match   – 0-100, how many required skills are present
      bonus_score   – 0-20, extra credit for advanced/bonus skills
      extracted     – list of found skills
      missing       – list of required skills NOT found
    """
    extracted = extract_skills_from_text(text)
    text_lower = text.lower()

    required   = rd["required"]
    bonus_list = rd.get("bonus", [])

    found_required = [s for s in required if normalise_skill(s) in extracted or s in text_lower]
    found_bonus    = [s for s in bonus_list if s in text_lower]
    missing        = [s for s in required if s not in found_required]

    req_ratio    = len(found_required) / max(len(required), 1)
    skill_match  = clamp(req_ratio * 85 + (len(found_bonus) / max(len(bonus_list), 1)) * 15)
    bonus_score  = clamp((len(found_bonus) / max(len(bonus_list), 1)) * 20, 0, 20)

    return {
        "skill_match":  skill_match,
        "bonus_score":  bonus_score,
        "extracted":    extracted,
        "missing":      missing[:6],        # top 6 most important missing skills
        "found_required": found_required,
    }


def compute_experience_score(text: str) -> dict:
    """
    Scores experience 0-100 using:
      1. Presence of experience section
      2. Company tier (S / 1A / 1B / 2 / 3 / unknown) — main driver
         Scanned ONLY from the experience section, NOT projects.
      3. Seniority (intern vs full-time)
      4. Quantified impact metrics

    Duration is intentionally excluded — quality of company matters, not time spent.
    Returns best_tier for dynamic overall weight calculation.
    """
    text_lower = text.lower()
    score      = 0
    signals    = []

    # ── 1. Has an Experience section at all? ─────────────────────
    has_exp_section = any(kw in text_lower for kw in
                          ["experience", "work experience", "employment", "internship"])
    if not has_exp_section:
        return {"score": 5, "msg": "No work experience section found.",
                "level": "fresher", "best_tier": "unknown", "matched_companies": []}

    score += 10   # base for having experience

    # ── 2. Company Tier — graduated scoring ──────────────────────
    best_tier, matched_companies = detect_company_tier(text_lower)
    tier_score = TIER_SCORE_MAP[best_tier]
    score += tier_score

    if matched_companies:
        tier_label = {
            "S":  "FAANG / Global top-tier",
            "1A": "Indian unicorn / top product company",
            "1B": "Reputed startup / EdTech product company",
            "2":  "IT services / consulting company",
            "3":  "Bootcamp / low-signal internship provider",
        }.get(best_tier, "Unknown")
        signals.append(
            f"{tier_label} experience: {', '.join(matched_companies)} "
            f"(Tier {best_tier}, +{tier_score} pts)"
        )
    else:
        signals.append("No well-known company found; startup/self experience assumed. (+5 pts)")

    # ── 3. Seniority signals ─────────────────────────────────────
    is_fulltime = any(kw in text_lower for kw in
                      ["software engineer", "swe", "developer", "engineer at",
                       "full time", "full-time", "present"])
    is_intern   = any(kw in text_lower for kw in
                      ["intern", "internship", "trainee"])

    if is_fulltime and not is_intern:
        score += 20
        signals.append("Full-time employment detected.")
    elif is_fulltime and is_intern:
        score += 12
        signals.append("Mix of internship and full-time roles detected.")
    elif is_intern:
        score += 6
        signals.append("Internship experience detected.")

    # ── 4. Quantified achievements ───────────────────────────────
    impact_hits = len(re.findall(r'\d+\s*%|\d+x|\d+\s*ms|\d+\s*times', text_lower))
    if impact_hits >= 4:
        score += 10
        signals.append("Strong quantified impact metrics found.")
    elif impact_hits >= 1:
        score += 4
        signals.append("Some quantified impact found.")

    score = clamp(score)

    if score >= 80:
        level = "senior"
    elif score >= 55:
        level = "mid"
    elif score >= 30:
        level = "junior"
    else:
        level = "fresher"

    summary = " | ".join(signals) if signals else "Basic experience detected."
    return {
        "score":             score,
        "msg":               summary,
        "level":             level,
        "best_tier":         best_tier,
        "matched_companies": matched_companies,
    }


def compute_education_score(text: str) -> dict:
    """Score 0-100 based on degree, CGPA, and institution prestige."""
    text_lower = text.lower()
    score      = 0
    msg        = []

    # Degree type
    if any(d in text_lower for d in ["b.tech", "btech", "b.e.", "be ", "bachelor of technology",
                                      "bachelor of engineering"]):
        score += 40
        msg.append("B.Tech / B.E. degree detected.")
    elif any(d in text_lower for d in ["m.tech", "mtech", "m.e.", "msc", "m.sc", "master"]):
        score += 55
        msg.append("Master's degree detected.")
    elif any(d in text_lower for d in ["phd", "ph.d", "doctorate"]):
        score += 70
        msg.append("PhD detected.")
    elif any(d in text_lower for d in ["bca", "mca", "bsc", "b.sc"]):
        score += 30
        msg.append("BSc / BCA / MCA degree detected.")
    else:
        score += 15
        msg.append("No standard CS degree found.")

    # CGPA / Percentage
    cgpa_hits = re.findall(r'(\d+(?:\.\d+)?)\s*/\s*10', text_lower)
    if cgpa_hits:
        cgpa = float(cgpa_hits[0])
        if cgpa >= 9.0:
            score += 30
            msg.append(f"Excellent CGPA {cgpa}/10.")
        elif cgpa >= 8.0:
            score += 22
            msg.append(f"Good CGPA {cgpa}/10.")
        elif cgpa >= 7.0:
            score += 12
            msg.append(f"Average CGPA {cgpa}/10.")
        else:
            score += 4

    # Percentage
    pct_hits = re.findall(r'(\d+(?:\.\d+)?)\s*%', text)
    high_pcts = [float(p) for p in pct_hits if float(p) >= 85]
    if high_pcts:
        score += 10
        msg.append(f"High academic percentage: {max(high_pcts):.0f}%.")

    # Prestigious institutions (IIT, NIT, BITS, IIIT)
    if any(inst in text_lower for inst in ["iit", "nit ", "bits pilani", "iiit", "iim"]):
        score += 20
        msg.append("Prestigious institution detected.")
    elif "mmmut" in text_lower or "madan mohan" in text_lower:
        score += 8
        msg.append("MMMUT detected (state university).")

    return {"score": clamp(score), "msg": " | ".join(msg)}


def compute_project_score(text: str, rd: dict) -> dict:
    """Score 0-100 based on number, complexity, and deployment of projects."""
    text_lower = text.lower()
    score      = 0
    msg        = []

    # Count distinct project entries (rough heuristic)
    project_count = len(re.findall(
        r'\b(project|built|developed|created|designed|implemented)\b',
        text_lower))

    if project_count >= 8:
        score += 35
        msg.append(f"High number of project signals ({project_count}).")
    elif project_count >= 4:
        score += 25
        msg.append(f"Good project count ({project_count}).")
    elif project_count >= 2:
        score += 15
        msg.append(f"Some projects detected ({project_count}).")
    else:
        score += 5
        msg.append("Very few project signals found.")

    # Deployment signals
    deploy_hits = sum(1 for kw in ["vercel", "render", "heroku", "netlify",
                                    "aws", "firebase hosting", "live", "deployed",
                                    "production", "github pages"]
                      if kw in text_lower)
    if deploy_hits >= 3:
        score += 25
        msg.append("Multiple deployed / live projects.")
    elif deploy_hits >= 1:
        score += 12
        msg.append("At least one deployed project.")
    else:
        score += 0
        msg.append("No deployment signals found.")

    # Full-stack project signals
    if all(kw in text_lower for kw in ["react", "node", "mongodb"]):
        score += 10
        msg.append("Full-stack MERN projects detected.")
    elif any(kw in text_lower for kw in ["rest api", "backend", "express"]):
        score += 6

    # GitHub links
    if "github.com" in text_lower or "git_repo" in text_lower:
        score += 10
        msg.append("GitHub links present.")

    # Complexity signals (auth, payment, real-time, map, etc.)
    complexity_keywords = ["jwt", "oauth", "stripe", "razorpay", "websocket",
                           "socket.io", "google map", "cloudinary", "redis",
                           "microservice", "lld", "system design", "kafka"]
    complex_hits = sum(1 for kw in complexity_keywords if kw in text_lower)
    if complex_hits >= 3:
        score += 15
        msg.append("High project complexity (auth, payments, real-time, etc.).")
    elif complex_hits >= 1:
        score += 7
        msg.append("Some technical depth in projects.")

    return {"score": clamp(score), "msg": " | ".join(msg)}


def compute_ats_score(text: str) -> dict:
    """
    ATS (Applicant Tracking System) readability score.
    Checks for: action verbs, quantified bullets, section headers,
    appropriate length, keywords density.
    """
    text_lower = text.lower()
    score      = 0
    msg        = []

    # Action verbs
    action_verbs = ["developed", "built", "designed", "implemented", "improved",
                    "created", "managed", "led", "delivered", "optimised",
                    "reduced", "increased", "deployed", "migrated", "integrated",
                    "revamped", "owned", "architected", "launched"]
    verb_hits = sum(1 for v in action_verbs if v in text_lower)
    if verb_hits >= 8:
        score += 25
        msg.append("Strong use of action verbs.")
    elif verb_hits >= 4:
        score += 15
        msg.append("Moderate use of action verbs.")
    else:
        score += 5
        msg.append("Weak action verb usage.")

    # Quantified achievements
    quant_hits = len(re.findall(r'\d+\s*%|\d+x|\$\d+|\d+\s*ms|\d+\+?\s*(users|requests|queries)',
                                 text_lower))
    if quant_hits >= 5:
        score += 25
        msg.append("Excellent quantified achievements.")
    elif quant_hits >= 2:
        score += 15
        msg.append("Some quantified achievements.")
    else:
        score += 3
        msg.append("Very few numbers / metrics in bullets.")

    # Section headers present
    sections = ["education", "experience", "project", "skill", "achievement", "certification"]
    found_sections = sum(1 for s in sections if s in text_lower)
    score += min(found_sections * 4, 20)

    # Resume length (words)
    word_count = len(text.split())
    if 300 <= word_count <= 700:
        score += 15
        msg.append("Good resume length.")
    elif word_count > 700:
        score += 8
        msg.append("Resume slightly long.")
    else:
        score += 3
        msg.append("Resume too short.")

    # Contact info
    has_email   = bool(re.search(r'[\w.\-]+@[\w.\-]+\.\w+', text))
    has_github  = "github" in text_lower
    has_linkedin = "linkedin" in text_lower
    if has_email:
        score += 5
    if has_github:
        score += 3
    if has_linkedin:
        score += 3

    return {"score": clamp(score), "msg": " | ".join(msg)}


def compute_competitive_programming_bonus(text: str) -> int:
    """Extra bonus (0-10) for competitive programmers."""
    text_lower = text.lower()
    bonus = 0
    cp_platforms = ["codeforces", "codechef", "leetcode", "hackerrank",
                    "atcoder", "kickstart", "icpc", "stopstalk"]
    cp_hits = sum(1 for p in cp_platforms if p in text_lower)
    if cp_hits >= 2:
        bonus += 5
    rating_hits = re.findall(r'rating\s*:\s*(\d+)', text_lower)
    if rating_hits and int(rating_hits[0]) >= 1600:
        bonus += 3
    if "global rank" in text_lower:
        bonus += 2
    return min(bonus, 10)


def generate_recommendations(text: str, rd: dict, skill_data: dict,
                               exp_data: dict, proj_data: dict) -> list[str]:
    """Generate personalised, ranked recommendations."""
    recs  = []
    t     = text.lower()
    level = exp_data["level"]

    # Skill gap recommendations
    for skill in skill_data["missing"][:3]:
        recs.append(f"Learn {skill.title()} — it is a core requirement for this role.")

    # Level-specific
    if level == "fresher":
        recs.append("Complete at least one internship or open-source contribution before applying.")
        recs.append("Build 2-3 full-stack projects with live deployments to strengthen your portfolio.")
    elif level == "junior":
        recs.append("Focus on project depth: add auth, payments, and real-time features to existing projects.")
        recs.append("Contribute to open source to demonstrate collaboration and code quality.")
    elif level in ("mid", "senior"):
        recs.append("Highlight system design decisions and architectural choices in your resume bullets.")
        recs.append("Quantify the business/performance impact of every feature you built.")

    # General quality tips
    if "github" not in t:
        recs.append("Add your GitHub profile link — recruiters always check it.")
    if "deployed" not in t and "live" not in t and "vercel" not in t:
        recs.append("Deploy your projects and add live links; it signals real-world readiness.")
    if not re.search(r'\d+\s*%|\d+x', t):
        recs.append("Add measurable impact numbers (e.g., 'Reduced load time by 40%') to your bullets.")

    # Add role-specific suggestions
    recs.extend(rd["suggestions"])

    # Deduplicate and limit
    seen = set()
    unique_recs = []
    for r in recs:
        key = r[:40].lower()
        if key not in seen:
            seen.add(key)
            unique_recs.append(r)

    return unique_recs[:7]


def generate_explanations(skill_data: dict, exp_data: dict,
                           proj_data: dict, edu_data: dict,
                           ats_data: dict) -> list[dict]:
    """Generate itemised explanations for each scored area."""
    explanations = []

    def severity(score):
        if score < 40: return "high"
        if score < 65: return "medium"
        return "low"

    explanations.append({
        "area":       "Skills",
        "issue":      f"Matched {skill_data['skill_match']}% of required skills.",
        "suggestion": f"Missing: {', '.join(skill_data['missing'][:4]) or 'None'}.",
        "severity":   severity(skill_data["skill_match"]),
    })
    explanations.append({
        "area":       "Experience",
        "issue":      exp_data["msg"],
        "suggestion": ("Pursue longer internships or full-time roles at product companies."
                       if exp_data["level"] in ("fresher", "junior")
                       else "Highlight ownership and cross-functional impact."),
        "severity":   severity(exp_data["score"]),
    })
    explanations.append({
        "area":       "Projects",
        "issue":      proj_data["msg"],
        "suggestion": ("Deploy projects and add live links and GitHub repos."
                       if proj_data["score"] < 60
                       else "Add more technical depth and complexity to existing projects."),
        "severity":   severity(proj_data["score"]),
    })
    explanations.append({
        "area":       "Education",
        "issue":      edu_data["msg"],
        "suggestion": ("Maintain CGPA > 8 and highlight relevant coursework."
                       if edu_data["score"] < 60
                       else "Your educational background is competitive."),
        "severity":   severity(edu_data["score"]),
    })
    explanations.append({
        "area":       "ATS / Resume Quality",
        "issue":      ats_data["msg"],
        "suggestion": ("Use more action verbs and add measurable metrics to every bullet point."
                       if ats_data["score"] < 60
                       else "Resume quality is good; ensure it is in clean single-column format."),
        "severity":   severity(ats_data["score"]),
    })

    return explanations


# ══════════════════════════════════════════════════════════════════
# MAIN ANALYSIS ENDPOINT
# ══════════════════════════════════════════════════════════════════

@app.post("/analyze")
async def analyze(
    role: str = Form(...),
    file: Optional[UploadFile] = File(None),
    resume_text: Optional[str] = Form(None),
):
    # ── 1. Extract text ──────────────────────────────────────────
    text = ""
    if file:
        with tempfile.NamedTemporaryFile(delete=False) as tmp:
            tmp.write(await file.read())
            tmp_path = tmp.name
        try:
            if file.filename.lower().endswith(".pdf"):
                with pdfplumber.open(tmp_path) as pdf:
                    text = "\n".join(
                        [p.extract_text() for p in pdf.pages if p.extract_text()]
                    )
            else:
                doc = Document(tmp_path)
                text = "\n".join([p.text for p in doc.paragraphs])
        finally:
            os.unlink(tmp_path)
    else:
        text = resume_text or ""

    if len(text.strip()) < 50:
        raise HTTPException(status_code=400, detail="Resume text too short or unreadable.")

    # ── 2. Detect role & load role data ─────────────────────────
    rk = detect_role_key(role)
    rd = ROLE_DB.get(rk, ROLE_DB["fullstack"])

    # ── 3. Run all sub-scorers ───────────────────────────────────
    skill_data = compute_skill_scores(text, rd)
    exp_data   = compute_experience_score(text)
    proj_data  = compute_project_score(text, rd)
    edu_data   = compute_education_score(text)
    ats_data   = compute_ats_score(text)
    cp_bonus   = compute_competitive_programming_bonus(text)

    # ── 4. Breakdown scores (each 0-100) ─────────────────────────
    breakdown = {
        "skills":     skill_data["skill_match"],
        "projects":   proj_data["score"],
        "experience": exp_data["score"],
        "education":  edu_data["score"],
    }

    # ── 5. Overall & ATS scores ──────────────────────────────────
    # Base weights: skills 30%, experience 25%, projects 25%, education 15%, cp 5%
    # Experience weight gets a BOOST based on company tier — the better the company,
    # the more experience matters relative to other signals.
    base_exp_weight  = 0.25
    tier_boost       = TIER_EXP_WEIGHT_BOOST.get(exp_data.get("best_tier", "unknown"), 0.0)
    exp_weight       = base_exp_weight + tier_boost          # e.g. FAANG → 0.35

    # Redistribute the extra weight from skills and projects equally
    redistribute     = tier_boost / 2
    skills_weight    = max(0.20, 0.30 - redistribute)
    projects_weight  = max(0.15, 0.25 - redistribute)
    edu_weight       = 0.15

    raw_overall = (
        breakdown["skills"]     * skills_weight  +
        breakdown["experience"] * exp_weight     +
        breakdown["projects"]   * projects_weight +
        breakdown["education"]  * edu_weight
    )
    # Apply CP bonus (max +5 to overall)
    overall_score = clamp(raw_overall + cp_bonus * 0.5)

    # ATS score weighted with skill match
    ats_score = clamp(ats_data["score"] * 0.65 + skill_data["skill_match"] * 0.35)

    # Skill match displayed value
    skill_match = skill_data["skill_match"]

    # ── 6. Confidence level: how much data did we find? ──────────
    word_count       = len(text.split())
    confidence_level = clamp(
        50
        + (20 if word_count > 200 else 0)
        + (15 if exp_data["score"] > 20 else 0)
        + (10 if proj_data["score"] > 20 else 0)
        + (5  if edu_data["score"] > 20 else 0)
    )

    # ── 7. Personalised recommendations & explanations ───────────
    recommendations = generate_recommendations(text, rd, skill_data, exp_data, proj_data)
    explanations    = generate_explanations(skill_data, exp_data, proj_data, edu_data, ats_data)

    # ── 8. Return final payload ──────────────────────────────────
    return {
        "overall_score":    overall_score,
        "ats_score":        ats_score,
        "skill_match":      skill_match,
        "breakdown":        breakdown,
        "extracted_skills": skill_data["extracted"],
        "missing_skills":   skill_data["missing"],
        "recommendations":  recommendations,
        "suggested_projects": rd["projects"],
        "courses":          rd["courses"],
        "jobs":             rd["jobs"],
        "explanations":     explanations,
        "confidence_level": confidence_level,

        # Extra metadata (optional, useful for debugging / UI details)
        "_meta": {
            "role_key":            rk,
            "experience_level":    exp_data["level"],
            "company_tier":        exp_data.get("best_tier", "unknown"),
            "matched_companies":   exp_data.get("matched_companies", []),
            "exp_weight_used":     round(base_exp_weight + tier_boost, 2),
            "tier_boost_applied":  round(tier_boost, 2),
            "cp_bonus":            cp_bonus,
            "word_count":          word_count,
        },
    }


# ══════════════════════════════════════════════════════════════════
# HEALTH CHECK
# ══════════════════════════════════════════════════════════════════
@app.get("/health")
def health():
    return {"status": "ok", "service": "Career Readiness ML Service"}


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
