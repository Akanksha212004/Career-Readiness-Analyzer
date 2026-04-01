import os
import re
import math
import tempfile
import pdfplumber
from docx import Document
from fastapi import FastAPI, File, UploadFile, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List
import uvicorn
from dotenv import load_dotenv
from groq import Groq

# ── NLP / ML Imports ──────────────────────────────────────────────
import spacy
from sentence_transformers import SentenceTransformer, util
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity as sk_cosine
import numpy as np

load_dotenv()

# ══════════════════════════════════════════════════════════════════
# MODEL LOADING (runs once at startup)
# ══════════════════════════════════════════════════════════════════
print("Loading spaCy model...")
nlp_model = spacy.load("en_core_web_md")
print("spaCy loaded")

print("Loading Sentence Transformer model...")
embedder = SentenceTransformer("all-MiniLM-L6-v2")
print("Sentence Transformer loaded")

app = FastAPI(title="Career Readiness ML Service — Intelligent Edition")

# ── CORS ──────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:8080", "http://localhost:5173", "http://localhost:5000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Pydantic Models ───────────────────────────────────────────────
class ChatMessage(BaseModel):
    role: str
    content: str

class ChatRequest(BaseModel):
    message: str
    role: str = ""
    history: List[ChatMessage] = []

class ChatResponse(BaseModel):
    reply: str


# ══════════════════════════════════════════════════════════════════
# ROLE KNOWLEDGE BASE
# ══════════════════════════════════════════════════════════════════
ROLE_DB = {
    "frontend": {
        "required": [
            "html", "css", "javascript", "typescript", "react", "next.js", "nextjs",
            "redux", "git", "github", "jest", "testing", "figma", "tailwind", "tailwindcss",
            "webpack", "vite", "responsive design", "bootstrap", "sass", "ci/cd",
            "react hooks", "component design", "web performance", "accessibility"
        ],
        "jd_text": """Frontend developer skilled in HTML CSS JavaScript TypeScript React Next.js
            Redux state management Git version control Jest unit testing Figma design tools
            Tailwind CSS responsive design webpack vite build tools CI/CD pipelines
            web accessibility performance optimization component architecture""",
        "courses": [
            {"title": "React - The Complete Guide", "platform": "Udemy", "link": "https://udemy.com/course/react-the-complete-guide-incl-redux/", "duration": "40 hours"},
            {"title": "TypeScript for Professionals", "platform": "Frontend Masters", "link": "https://frontendmasters.com/courses/typescript-v4/", "duration": "12 hours"},
            {"title": "JavaScript Algorithms & DS", "platform": "freeCodeCamp", "link": "https://freecodecamp.org/learn/javascript-algorithms-and-data-structures/", "duration": "300 hours"},
            {"title": "CSS for JavaScript Developers", "platform": "Josh Comeau", "link": "https://css-for-js.dev", "duration": "20 hours"},
        ],
        "jobs": [
            {"role": "Frontend Intern", "company": "Google", "location": "Remote", "apply_link": "https://careers.google.com"},
            {"role": "React Developer Intern", "company": "Meta", "location": "Menlo Park, CA", "apply_link": "https://metacareers.com"},
            {"role": "UI Engineer Intern", "company": "Stripe", "location": "San Francisco, CA", "apply_link": "https://stripe.com/jobs"},
        ],
        "suggestions": [
            "Learn TypeScript — it is required in 85% of frontend roles today",
            "Build and deploy 2-3 projects on Vercel or Netlify with live links on your resume",
            "Add unit testing with Jest and React Testing Library to your skillset",
            "Contribute to open source React projects on GitHub to gain real experience",
        ],
        "projects": [
            "E-commerce dashboard with React + TypeScript + Redux",
            "Weather app with real API integration and responsive design",
            "Portfolio website with animations using Framer Motion",
        ],
        "project_signals": ["portfolio", "dashboard", "ecommerce", "landing page", "ui", "web app", "frontend", "react app"],
    },
    "backend": {
        "required": [
            "python", "node.js", "nodejs", "sql", "mysql", "postgresql", "mongodb",
            "docker", "aws", "redis", "rest api", "graphql", "git", "github",
            "jwt", "authentication", "express", "fastapi", "django", "flask",
            "system design", "linux", "microservices", "message queue", "kafka"
        ],
        "jd_text": """Backend developer skilled in Python Node.js SQL PostgreSQL MongoDB Docker
            AWS cloud Redis caching REST API design GraphQL Git authentication JWT
            Express FastAPI Django Flask system design Linux microservices
            message queues Kafka scalability performance""",
        "courses": [
            {"title": "Node.js - The Complete Guide", "platform": "Udemy", "link": "https://udemy.com/course/nodejs-the-complete-guide/", "duration": "35 hours"},
            {"title": "Docker & Kubernetes Masterclass", "platform": "Udemy", "link": "https://udemy.com/course/docker-kubernetes-the-complete-guide/", "duration": "25 hours"},
            {"title": "System Design Interview", "platform": "Educative", "link": "https://educative.io/courses/grokking-the-system-design-interview", "duration": "15 hours"},
            {"title": "PostgreSQL Bootcamp", "platform": "Udemy", "link": "https://udemy.com/course/sql-and-postgresql/", "duration": "22 hours"},
        ],
        "jobs": [
            {"role": "Backend Intern", "company": "Amazon", "location": "Seattle, WA", "apply_link": "https://amazon.jobs"},
            {"role": "API Developer Intern", "company": "Twilio", "location": "Remote", "apply_link": "https://twilio.com/careers"},
            {"role": "Software Engineer Intern", "company": "Cloudflare", "location": "Austin, TX", "apply_link": "https://cloudflare.com/careers"},
        ],
        "suggestions": [
            "Learn Docker and containerize at least one of your existing projects",
            "Build REST APIs with proper JWT authentication and error handling",
            "Study system design fundamentals — asked in nearly every backend interview",
            "Deploy a production API on AWS or Railway with a CI/CD pipeline",
        ],
        "projects": [
            "REST API with JWT auth, rate limiting, and role-based access control",
            "URL shortener with Redis caching and click analytics",
            "Microservices demo with Docker Compose and API gateway",
        ],
        "project_signals": ["api", "server", "backend", "database", "microservice", "rest", "endpoint"],
    },
    "fullstack": {
        "required": [
            "html", "css", "javascript", "typescript", "react", "node.js", "nodejs",
            "sql", "mongodb", "git", "rest api", "docker", "aws", "redux", "next.js",
            "postgresql", "authentication", "deployment", "ci/cd"
        ],
        "jd_text": """Full stack developer HTML CSS JavaScript TypeScript React Node.js
            SQL MongoDB PostgreSQL Git REST API Docker AWS Redux Next.js
            authentication deployment CI/CD full stack web development""",
        "courses": [
            {"title": "MERN Stack - The Complete Guide", "platform": "Udemy", "link": "https://udemy.com/course/mern-stack-course-mongodb-express-react-and-nodejs/", "duration": "45 hours"},
            {"title": "Next.js & React Complete Guide", "platform": "Udemy", "link": "https://udemy.com/course/nextjs-react-the-complete-guide/", "duration": "25 hours"},
            {"title": "MongoDB - The Complete Guide", "platform": "Udemy", "link": "https://udemy.com/course/mongodb-the-complete-developers-guide/", "duration": "18 hours"},
            {"title": "AWS for Beginners", "platform": "Coursera", "link": "https://coursera.org/learn/aws-cloud-practitioner-essentials", "duration": "15 hours"},
        ],
        "jobs": [
            {"role": "Full Stack Intern", "company": "Atlassian", "location": "Remote", "apply_link": "https://atlassian.com/company/careers"},
            {"role": "Web Developer Intern", "company": "Shopify", "location": "Remote", "apply_link": "https://shopify.com/careers"},
            {"role": "Software Engineer Intern", "company": "GitHub", "location": "Remote", "apply_link": "https://github.com/about/careers"},
        ],
        "suggestions": [
            "Build a complete MERN or Next.js full-stack app with authentication and deployment",
            "Learn both SQL and NoSQL databases — versatility is key for full stack roles",
            "Add a CI/CD pipeline using GitHub Actions to at least one project",
            "Deploy your full-stack app on cloud — try Vercel for frontend + Railway for backend",
        ],
        "projects": [
            "Social media app with MERN stack, real-time chat using Socket.io",
            "E-commerce platform with Stripe payment integration and admin panel",
            "Blog CMS with Next.js, PostgreSQL, and markdown support",
        ],
        "project_signals": ["fullstack", "full stack", "web app", "mern", "mean", "nextjs", "full-stack"],
    },
    "ml": {
        "required": [
            "python", "tensorflow", "pytorch", "numpy", "pandas", "scikit-learn",
            "matplotlib", "seaborn", "nlp", "deep learning", "cnn", "rnn", "lstm",
            "opencv", "keras", "mlops", "aws", "docker", "jupyter", "kaggle",
            "bert", "transformers", "hugging face", "data preprocessing", "feature engineering"
        ],
        "jd_text": """Machine learning engineer Python TensorFlow PyTorch NumPy Pandas
            Scikit-learn deep learning CNN RNN LSTM NLP OpenCV Keras MLOps
            AWS Docker Jupyter Kaggle BERT Transformers HuggingFace
            data preprocessing feature engineering model deployment""",
        "courses": [
            {"title": "Deep Learning Specialization", "platform": "Coursera", "link": "https://coursera.org/specializations/deep-learning", "duration": "60 hours"},
            {"title": "Fast.ai Practical Deep Learning", "platform": "fast.ai", "link": "https://fast.ai", "duration": "30 hours"},
            {"title": "MLOps Fundamentals", "platform": "Google Cloud", "link": "https://cloud.google.com/training/machinelearning-ai", "duration": "20 hours"},
            {"title": "Kaggle ML Courses", "platform": "Kaggle", "link": "https://kaggle.com/learn", "duration": "15 hours"},
        ],
        "jobs": [
            {"role": "ML Engineer Intern", "company": "OpenAI", "location": "San Francisco, CA", "apply_link": "https://openai.com/careers"},
            {"role": "Data Science Intern", "company": "Netflix", "location": "Remote", "apply_link": "https://jobs.netflix.com"},
            {"role": "AI Research Intern", "company": "Microsoft", "location": "Redmond, WA", "apply_link": "https://careers.microsoft.com"},
        ],
        "suggestions": [
            "Complete a PyTorch or TensorFlow course and build 2 end-to-end ML projects",
            "Participate in Kaggle competitions and add your ranking/medals to your resume",
            "Deploy a trained ML model using FastAPI + Docker — shows production readiness",
            "Write technical blogs about your ML experiments to showcase expertise",
        ],
        "projects": [
            "Image classification using CNN achieving 90%+ accuracy on benchmark dataset",
            "Sentiment analysis NLP pipeline using BERT on real-world Twitter data",
            "End-to-end ML pipeline with feature engineering, training, and FastAPI deployment",
        ],
        "project_signals": ["model", "prediction", "classification", "nlp", "neural", "machine learning", "dataset", "training", "accuracy"],
    },
    "devops": {
        "required": [
            "docker", "kubernetes", "aws", "linux", "git", "ci/cd", "cicd",
            "jenkins", "ansible", "terraform", "bash", "python", "monitoring",
            "prometheus", "grafana", "nginx", "github actions", "helm", "argocd"
        ],
        "jd_text": """DevOps engineer Docker Kubernetes AWS Linux Git CI/CD Jenkins
            Ansible Terraform Bash scripting Python monitoring Prometheus Grafana
            Nginx GitHub Actions Helm ArgoCD infrastructure automation cloud deployment""",
        "courses": [
            {"title": "Docker & Kubernetes Complete Guide", "platform": "Udemy", "link": "https://udemy.com/course/docker-and-kubernetes-the-complete-guide/", "duration": "22 hours"},
            {"title": "AWS Certified DevOps Engineer", "platform": "Coursera", "link": "https://coursera.org/professional-certificates/aws-devops", "duration": "40 hours"},
            {"title": "Terraform for Beginners to Advanced", "platform": "Udemy", "link": "https://udemy.com/course/terraform-beginner-to-advanced/", "duration": "15 hours"},
            {"title": "Linux Command Line Bootcamp", "platform": "Udemy", "link": "https://udemy.com/course/the-linux-command-line-bootcamp/", "duration": "14 hours"},
        ],
        "jobs": [
            {"role": "DevOps Intern", "company": "HashiCorp", "location": "Remote", "apply_link": "https://hashicorp.com/jobs"},
            {"role": "Cloud Engineer Intern", "company": "AWS", "location": "Seattle, WA", "apply_link": "https://amazon.jobs"},
            {"role": "SRE Intern", "company": "Cloudflare", "location": "Remote", "apply_link": "https://cloudflare.com/careers"},
        ],
        "suggestions": [
            "Master Docker and Kubernetes — they are the foundation of modern DevOps",
            "Build a complete CI/CD pipeline using GitHub Actions for any of your projects",
            "Get AWS Cloud Practitioner certification — it is free to study and boosts resume",
            "Practice Linux administration and write bash scripts for automation",
        ],
        "projects": [
            "Full CI/CD pipeline with GitHub Actions, Docker, and automated testing",
            "Kubernetes cluster deployment on AWS EKS with auto-scaling",
            "Infrastructure as Code using Terraform to provision AWS resources",
        ],
        "project_signals": ["deployment", "pipeline", "infrastructure", "cloud", "devops", "automation", "ci/cd"],
    },
}

# ── Stopwords ─────────────────────────────────────────────────────
STOP_WORDS = {
    "a","an","the","and","or","but","in","on","at","to","for","of","with",
    "by","from","is","are","was","were","be","been","have","has","had",
    "do","does","did","will","would","could","should","i","my","me","we",
    "our","you","your","he","she","it","they","their","this","that","not",
}

# ══════════════════════════════════════════════════════════════════
# TOP COMPANIES LIST (used across scoring)
# ══════════════════════════════════════════════════════════════════
TOP_COMPANIES = [
    # FAANG+
    "google", "microsoft", "amazon", "meta", "facebook", "apple", "netflix",
    # Tier-1 Product Companies
    "openai", "adobe", "uber", "airbnb", "stripe", "shopify", "atlassian",
    "salesforce", "linkedin", "twitter", "snapchat", "pinterest",
    # Big Tech / Cloud
    "oracle", "sap", "ibm", "intel", "nvidia", "amd", "cisco",
    # High-paying startups / unicorns
    "notion", "figma", "canva", "dropbox", "slack", "discord", "zoom",
    # Indian Top Tech Companies
    "flipkart", "zomato", "swiggy", "paytm", "ola", "razorpay", "cred",
    "meesho", "groww", "zerodha", "freshworks", "postman",
    # Consulting / Big Tech Services
    "tcs", "infosys", "wipro", "hcl", "accenture", "deloitte"
]

STARTUP_KEYWORDS = ["startup", "early stage", "seed", "series a"]


# ══════════════════════════════════════════════════════════════════
# ALGORITHM 1: NLP PREPROCESSING using spaCy
# ══════════════════════════════════════════════════════════════════
def nlp_preprocess_spacy(text: str) -> tuple:
    doc = nlp_model(text[:50000])
    tokens, lemmas = [], []
    for token in doc:
        if not token.is_stop and not token.is_punct and len(token.text) > 1:
            tokens.append(token.text.lower())
            lemmas.append(token.lemma_.lower())
    return tokens, lemmas, doc


# ══════════════════════════════════════════════════════════════════
# ALGORITHM 2: ATS SCORE
# ══════════════════════════════════════════════════════════════════
def calculate_ats_score(resume_text: str, role_data: dict) -> int:
    tl = resume_text.lower()
    sections = {
        "education":  bool(re.search(r"education|degree|university|college|b\.?tech|bachelor|master|cgpa|gpa", tl)),
        "experience": bool(re.search(r"experience|internship|worked|employed|company|organization", tl)),
        "skills":     bool(re.search(r"skill|technical skill|proficient|expertise|competenc", tl)),
        "projects":   bool(re.search(r"project|built|developed|implemented|created|designed", tl)),
        "contact":    bool(re.search(r"email|phone|linkedin|github|@|contact", tl)),
        "summary":    bool(re.search(r"summary|objective|about me|profile", tl)),
    }
    section_score = sum(sections.values()) / len(sections) * 35
    _, lemmas, _ = nlp_preprocess_spacy(resume_text)
    lemma_text = " ".join(lemmas)
    found = sum(1 for skill in role_data["required"]
                if skill.lower() in tl or skill.lower().replace(".", "") in tl or skill.lower() in lemma_text)
    keyword_score = min(65, (found / max(len(role_data["required"]), 1)) * 65)
    return clamp(int(section_score + keyword_score))


# ══════════════════════════════════════════════════════════════════
# ALGORITHM 3: SKILL EXTRACTION
# ══════════════════════════════════════════════════════════════════
def extract_skills_spacy(resume_text: str, required: list) -> tuple:
    tl = resume_text.lower()
    _, lemmas, _ = nlp_preprocess_spacy(resume_text)
    lemma_text = " ".join(lemmas)
    extracted, missing = [], []
    for skill in required:
        skill_l = skill.lower()
        skill_clean = skill_l.replace(".", "").replace(" ", "")
        text_clean  = tl.replace(".", "").replace(" ", "")
        found = (
            skill_l in tl or
            skill_l in lemma_text or
            skill_clean in text_clean or
            skill_l.replace(".js", "js") in tl or
            skill_l.replace("-", "") in tl.replace("-", "")
        )
        display = skill.upper() if len(skill) <= 4 else skill.title()
        if found:
            extracted.append(display)
        else:
            missing.append(display)
    return extracted[:10], missing[:8]


# ══════════════════════════════════════════════════════════════════
# ALGORITHM 4a: SEMANTIC SIMILARITY (Sentence Transformers)
# ══════════════════════════════════════════════════════════════════
def calculate_semantic_skill_match(resume_text: str, role_data: dict) -> int:
    resume_embedding = embedder.encode(resume_text[:3000], convert_to_tensor=True)
    jd_embedding     = embedder.encode(role_data["jd_text"], convert_to_tensor=True)
    sim = float(util.cos_sim(resume_embedding, jd_embedding)[0][0])
    return clamp(int((sim - 0.1) / 0.6 * 100))


# ══════════════════════════════════════════════════════════════════
# ALGORITHM 4b: TF-IDF COSINE
# ══════════════════════════════════════════════════════════════════
def calculate_tfidf_match(resume_text: str, role_data: dict) -> int:
    try:
        vectorizer = TfidfVectorizer(stop_words="english", ngram_range=(1, 2))
        corpus = [resume_text[:5000], role_data["jd_text"]]
        tfidf_matrix = vectorizer.fit_transform(corpus)
        sim = float(sk_cosine(tfidf_matrix[0], tfidf_matrix[1])[0][0])
        return clamp(int(sim * 100))
    except Exception:
        return 50


# ══════════════════════════════════════════════════════════════════
# HELPER: Check if resume has a top company experience
# ══════════════════════════════════════════════════════════════════
def detect_top_company(text_lower: str) -> tuple[bool, str]:
    """
    Returns (found: bool, company_name: str).

    STRICT matching — searches ONLY inside the EXPERIENCE section.
    This prevents false positives like:
      - "Qualified for The Big Code by Google"  → achievements section, IGNORED
      - "Google Cloud course"                   → skills/cert section, IGNORED
      - "I want to work at Amazon"              → not an employer, IGNORED

    Only real employer entries like these are matched:
      - "Amazon – Software Development Engineer Intern"
      - "Web Development Intern, NullClass"
      - "SDE Intern at Microsoft"
    """

    # ── Step 1: Extract ONLY the experience section ───────────────
    # Grab text between "experience" heading and next major section heading
    exp_match = re.search(
        r"\bexperience\b\s*\n(.+?)(?=\n\s*\b(education|projects?|technical skills?|skills?|certifications?|achievements?|awards?|activities|publications?)\b)",
        text_lower,
        re.IGNORECASE | re.DOTALL
    )

    if exp_match:
        exp_text = exp_match.group(1)
        print(f"[EXP] Experience section found ({len(exp_text)} chars): {exp_text[:120]!r}")
    else:
        # Fallback: use first 600 chars after "experience" keyword
        idx = text_lower.find("experience")
        if idx == -1:
            print("[EXP] No experience section found at all")
            return False, ""
        exp_text = text_lower[idx: idx + 600]
        print(f"[EXP] Experience section fallback ({len(exp_text)} chars)")

    # ── Step 2: Match company name + job title INSIDE exp_text only ─

    # Pattern A: "Amazon – SDE Intern" / "Amazon | Engineer"
    pattern_a = re.compile(
        r"\b(" + "|".join(re.escape(c) for c in TOP_COMPANIES) + r")\b"
        r"\s*[-–|,at ]{1,6}\s*"
        r".{0,80}"
        r"\b(intern|internship|engineer|developer|analyst|sde|swe|scientist|designer|consultant)\b",
        re.IGNORECASE | re.DOTALL
    )

    # Pattern B: "SDE Intern, Amazon" / "Web Developer at Google"
    pattern_b = re.compile(
        r"\b(intern|internship|engineer|developer|analyst|sde|swe|scientist|designer|consultant)\b"
        r".{0,60}"
        r"\b(" + "|".join(re.escape(c) for c in TOP_COMPANIES) + r")\b",
        re.IGNORECASE | re.DOTALL
    )

    m1 = pattern_a.search(exp_text)
    if m1:
        company_name = m1.group(1)
        print(f"[EXP] Tier 1 confirmed in exp section (A — company→role): {company_name}")
        return True, company_name

    m2 = pattern_b.search(exp_text)
    if m2:
        company_name = m2.group(2)
        print(f"[EXP] Tier 1 confirmed in exp section (B — role→company): {company_name}")
        return True, company_name

    print("[EXP] No top company found as actual employer in experience section")
    return False, ""


# ══════════════════════════════════════════════════════════════════
# HELPER: Extract real experience duration (strict — avoids year ranges)
# ══════════════════════════════════════════════════════════════════
def extract_experience_duration_score(text_lower: str) -> int:
    """
    Extracts ONLY explicit duration mentions like:
      "2 months", "6 months", "1 year", "1.5 years"
    
    DELIBERATELY ignores:
      - Year ranges like "2023 – 2025" (those are dates, not durations)
      - Standalone years like "2024"
    
    Returns a bonus score (0-20).
    """
    # Pattern: number (int or decimal) followed by month/year word
    # Must NOT be preceded by another 4-digit year pattern (avoids "2023 - 2 months" edge case)
    duration_pattern = re.compile(
        r"(?<!\d{4}\s{0,5})"          # not preceded by a 4-digit year
        r"(\d+(?:\.\d+)?)"             # number like 2 or 1.5
        r"\s*"
        r"(months?|years?|yrs?|mos?)"  # time unit
        r"(?!\s*[-–]\s*\d{4})",        # not followed by "- 2025" (date range)
        re.IGNORECASE
    )

    total_months = 0
    for match in duration_pattern.finditer(text_lower):
        num = float(match.group(1))
        unit = match.group(2).lower()
        if "year" in unit or "yr" in unit:
            total_months += num * 12
        else:
            total_months += num

    print(f"[EXP] Detected duration: {total_months:.1f} months")

    # Convert to a bonus score (capped at 20)
    if total_months >= 12:
        return 20
    elif total_months >= 6:
        return 15
    elif total_months >= 3:
        return 10
    elif total_months > 0:
        return 5
    return 0


# ══════════════════════════════════════════════════════════════════
# ALGORITHM 5: SECTION SCORES + WEIGHTED READINESS
# ══════════════════════════════════════════════════════════════════
def calculate_section_scores(resume_text: str, role_data: dict, extracted: list) -> dict:
    tl = resume_text.lower()

    # ── 1. SKILLS SCORE ──────────────────────────────────────────
    skills_score = clamp(int(len(extracted) / max(len(role_data["required"]), 1) * 100))

    # ── 2. EXPERIENCE SCORE (FIXED) ──────────────────────────────
    #
    # PROBLEM (old code):
    #   - duration regex matched year ranges like "2023-2027" → false score boost
    #   - Normal internship at unknown company could score 70-80 due to
    #     company_score(15) + duration_score(high from false matches)
    #   - Top company was only 90, so gap was tiny
    #
    # FIX (new logic):
    #   Tier 1 – Top company (Amazon, Google, etc.)  → base 88, small duration bonus → max ~95
    #   Tier 2 – Normal internship (any company)     → base 45, small bonuses        → max ~65
    #   Tier 3 – No internship detected              → base 10, small bonuses        → max ~30
    #
    # This ensures clear, meaningful separation between tiers.
    # ─────────────────────────────────────────────────────────────

    found_top_company, company_name = detect_top_company(tl)
    has_internship = bool(re.search(r"\bintern(ship)?\b", tl))
    has_work_exp   = bool(re.search(r"work(ed)?\s+(at|for|with)|employed|full.?time", tl))
    duration_bonus = extract_experience_duration_score(tl)

    if found_top_company:
        # TIER 1: Top company internship/job
        # Base 88 ensures clear advantage; duration bonus adds up to 7 more
        base = 88
        experience_score = clamp(int(base + min(duration_bonus, 7)))
        print(f"[EXP] Tier 1 — Top company ({company_name}): {experience_score}")

    elif has_internship or has_work_exp:
        # TIER 2: Regular internship or job at non-top company
        # Base 45 → with bonuses max ~65, clearly below Tier 1
        base = 45

        # Small boost for named company presence
        if re.search(r"company|pvt|ltd|inc|solutions|tech|labs|systems", tl):
            base += 8

        # Startup boost
        if any(re.search(rf"\b{re.escape(kw)}\b", tl) for kw in STARTUP_KEYWORDS):
            base += 5

        # Duration bonus (max 12 for Tier 2 to keep ceiling at ~65)
        experience_score = clamp(int(base + min(duration_bonus, 12)))
        print(f"[EXP] Tier 2 — Regular internship: {experience_score}")

    else:
        # TIER 3: No internship / work experience detected
        # Base 10, freelance/open source can push to ~30
        base = 10

        if bool(re.search(r"freelance|contract|consultant", tl)):
            base += 15

        if "open source" in tl or "contribution" in tl:
            base += 8

        experience_score = clamp(int(base + min(duration_bonus, 8)))
        print(f"[EXP] Tier 3 — No experience: {experience_score}")

    # ── 3. PROJECT QUALITY SCORING ───────────────────────────────
    proj_signals = [
        bool(re.search(r"project|built|developed|implemented", tl)),
        any(kw in tl for kw in role_data.get("project_signals", [])),
    ]

    project_score_val = (sum(proj_signals) / len(proj_signals)) * 50

    if "github.com" in tl:
        project_score_val += 20
    if any(x in tl for x in ["vercel", "netlify", "heroku", "railway", "render", "live demo"]):
        project_score_val += 20
    if re.search(r"\d+\s*(users|stars|downloads|requests|clients|%)", tl):
        project_score_val += 20
    if any(k in tl for k in ["scalable", "architecture", "real-time", "optimization", "ai", "ml"]):
        project_score_val += 10

    # Multiple projects boost
    project_count = len(re.findall(r"\bproject\b", tl))
    if project_count >= 3:
        project_score_val += 15

    projects_score = clamp(int(project_score_val))

    # ── 4. EDUCATION SCORE ───────────────────────────────────────
    edu_signals = [
        bool(re.search(r"bachelor|b\.?tech|university|college", tl)),
        bool(re.search(r"cgpa|gpa|percentage", tl)),
    ]

    education_score = (sum(edu_signals) / len(edu_signals)) * 70

    # Top college boost
    if any(x in tl for x in ["iit", "nit", "bits", "iiit"]):
        education_score += 30

    education_score = clamp(int(education_score))

    return {
        "skills":     skills_score,
        "projects":   projects_score,
        "experience": experience_score,
        "education":  education_score,
    }


def weighted_readiness_score(bd: dict) -> int:
    # Extra bonus for truly exceptional experience (Tier 1 company)
    exp_bonus = 0
    if bd["experience"] >= 85:
        exp_bonus = 6
    elif bd["experience"] >= 60:
        exp_bonus = 2

    return clamp(int(
        0.30 * bd["skills"] +
        0.25 * bd["projects"] +
        0.35 * bd["experience"] +
        0.10 * bd["education"] +
        exp_bonus
    ))


def generate_explanations(bd, extracted, missing, ats, semantic_score):
    out = []
    if bd["skills"] < 60:
        out.append({"area": "Skills Gap", "severity": "high",
                    "issue": f"Only {len(extracted)} of {len(extracted)+len(missing)} required skills detected in your resume",
                    "suggestion": f"Add these key missing skills: {', '.join(missing[:4])}"})
    if bd["projects"] < 50:
        out.append({"area": "Projects", "severity": "high",
                    "issue": "No deployed projects or GitHub links detected in resume",
                    "suggestion": "Add 2-3 projects with live demo links, GitHub URLs, and quantified impact"})
    if bd["experience"] < 40:
        out.append({"area": "Experience", "severity": "medium",
                    "issue": "Limited work or internship experience found",
                    "suggestion": "Contribute to open source projects or take freelance work to build real experience"})
    if ats < 65:
        out.append({"area": "ATS Compatibility", "severity": "medium",
                    "issue": "Resume structure may not pass Applicant Tracking Systems",
                    "suggestion": "Use standard section headings and include role-specific keywords naturally"})
    if semantic_score < 40:
        out.append({"area": "Role Alignment", "severity": "medium",
                    "issue": "Resume content does not strongly align with the target role semantically",
                    "suggestion": "Tailor your resume language to match the role — use role-specific terminology"})
    if not out:
        out.append({"area": "Overall Quality", "severity": "low",
                    "issue": "Resume is strong but lacks quantified impact metrics",
                    "suggestion": "Add numbers to your achievements: '40% faster load time', 'served 1000+ users', etc."})
    return out[:4]


def clamp(n): return max(0, min(100, n))

def detect_role_key(role: str) -> str:
    r = role.lower()
    if any(k in r for k in ["frontend", "react", "ui", "angular", "vue"]): return "frontend"
    if any(k in r for k in ["backend", "node", "api", "server", "django"]): return "backend"
    if any(k in r for k in ["fullstack", "full stack", "mern", "mean", "full-stack"]): return "fullstack"
    if any(k in r for k in ["ml", "machine", "data", "ai", "deep", "nlp"]): return "ml"
    if any(k in r for k in ["devops", "cloud", "sre", "infrastructure"]): return "devops"
    return "frontend"


def extract_text_from_pdf(path: str) -> str:
    text = ""
    with pdfplumber.open(path) as pdf:
        for page in pdf.pages:
            t = page.extract_text()
            if t: text += t + "\n"
    return text.strip()

def extract_text_from_docx(path: str) -> str:
    doc = Document(path)
    return "\n".join(p.text for p in doc.paragraphs if p.text.strip())


# ══════════════════════════════════════════════════════════════════
# MAIN ANALYSIS PIPELINE
# ══════════════════════════════════════════════════════════════════
def analyze_pipeline(resume_text: str, role: str) -> dict:
    rk = detect_role_key(role)
    rd = ROLE_DB[rk]
    print(f"[ML] Analyzing for role: {role} (key: {rk})")
    tokens, lemmas, doc = nlp_preprocess_spacy(resume_text)
    print(f"[ML] Preprocessed — {len(tokens)} tokens, {len(lemmas)} lemmas")
    ats = calculate_ats_score(resume_text, rd)
    print(f"[ML] ATS Score: {ats}")
    extracted, missing = extract_skills_spacy(resume_text, rd["required"])
    print(f"[ML] Extracted: {extracted} | Missing: {missing[:4]}")
    semantic_score = calculate_semantic_skill_match(resume_text, rd)
    print(f"[ML] Semantic Score: {semantic_score}")
    tfidf_score = calculate_tfidf_match(resume_text, rd)
    print(f"[ML] TF-IDF Score: {tfidf_score}")
    skill_match = clamp(int(0.6 * semantic_score + 0.4 * tfidf_score))
    bd      = calculate_section_scores(resume_text, rd, extracted)
    overall = weighted_readiness_score(bd)
    print(f"[ML] Breakdown: {bd} | Overall: {overall}")
    explanations = generate_explanations(bd, extracted, missing, ats, semantic_score)
    confidence   = clamp(70 + min(20, len(resume_text.split()) // 50))
    return {
        "overall_score":      overall,
        "ats_score":          ats,
        "skill_match":        skill_match,
        "breakdown":          bd,
        "extracted_skills":   extracted or ["No matching skills found"],
        "missing_skills":     missing,
        "recommendations":    rd["suggestions"],
        "suggested_projects": rd["projects"],
        "courses":            rd["courses"],
        "jobs":               rd["jobs"],
        "explanations":       explanations,
        "confidence_level":   confidence,
    }


# ══════════════════════════════════════════════════════════════════
# CHATBOT
# ══════════════════════════════════════════════════════════════════
def detect_intent(msg: str, doc) -> str:
    msg_l = msg.lower()
    if any(w in msg_l for w in ["hello", "hi", "hey", "help", "start", "what can you"]):     return "greet"
    if any(w in msg_l for w in ["interview", "prepare", "question", "dsa", "leetcode"]):      return "interview"
    if any(w in msg_l for w in ["salary", "package", "ctc", "pay", "stipend"]):               return "salary"
    if any(w in msg_l for w in ["skill", "learn", "missing", "technology", "tech stack"]):    return "skills"
    if any(w in msg_l for w in ["project", "build", "portfolio", "idea", "what to build"]):   return "projects"
    if any(w in msg_l for w in ["course", "resource", "tutorial", "study", "where to learn"]): return "courses"
    if any(w in msg_l for w in ["job", "apply", "company", "intern", "hiring", "career"]):    return "jobs"
    if any(w in msg_l for w in ["ats", "resume", "format", "keyword", "cv", "template"]):     return "ats"
    if any(w in msg_l for w in ["score", "readiness", "rating", "algorithm", "how does"]):    return "score"
    if any(w in msg_l for w in ["github", "open source", "contribution", "repository"]):      return "github"
    return "general"


def get_chat_reply(message: str, role: str) -> str:
    rk  = detect_role_key(role)
    rd  = ROLE_DB.get(rk, ROLE_DB["frontend"])
    doc = nlp_model(message[:500])
    intent = detect_intent(message, doc)
    replies = {
        "greet":     f"Hi! I am your AI Career Counselor. I can help you with skills, projects, courses, and career tips for **{role}**. What would you like to know?",
        "skills":    f"For **{role}**, the most important skills are: **{', '.join(rd['required'][:8])}**.",
        "projects":  f"Great project ideas for **{role}**:\n" + "\n".join(f"• {p}" for p in rd["projects"]),
        "courses":   f"Top courses for **{role}**:\n" + "\n".join(f"• **{c['title']}** — {c['platform']} ({c['duration']})" for c in rd["courses"]),
        "jobs":      f"Top companies for **{role}**:\n" + "\n".join(f"• **{j['company']}** — {j['role']} ({j['location']})" for j in rd["jobs"]),
        "ats":       "To maximize your ATS score:\n• Use standard section headings\n• Avoid tables and images\n• Include role-specific keywords\n• Add measurable achievements",
        "score":     "Your score is calculated using 5 algorithms:\n1. spaCy NLP Preprocessing\n2. ATS Keyword Scoring\n3. Skill Extraction\n4. Sentence Transformers Semantic Similarity\n5. Weighted Readiness Formula",
        "github":    "Strong GitHub tips:\n• 3-5 pinned repos with clear READMEs\n• Consistent commit history\n• Contribute to open source\n• Add live demo links",
        "interview": f"For **{role}** interviews:\n• LeetCode DSA practice\n• System design basics\n• Deep-dive on your projects\n• Focus on: {', '.join(rd['required'][:5])}",
        "salary":    f"For **{role}** in India (2025):\n• Internship: ₹10k-₹80k/month\n• Entry-level: ₹4-15 LPA\n• Top MNCs: ₹25 LPA+",
        "general":   f"For **{role}**, focus on: strong projects + relevant skills + tailored resume. What would you like help with?",
    }
    return replies.get(intent, replies["general"])


# ══════════════════════════════════════════════════════════════════
# API ROUTES
# ══════════════════════════════════════════════════════════════════

@app.get("/health")
def health():
    return {
        "status": "ok",
        "service": "ml-service — Intelligent Edition",
        "models": ["spaCy en_core_web_md", "all-MiniLM-L6-v2 (Sentence Transformers)"],
    }

@app.get("/")
def root():
    return {
        "status": "ok",
        "service": "Career Readiness ML Service",
        "routes": ["/health", "/analyze", "/chat"]
    }


@app.post("/analyze")
async def analyze(
    role: str = Form(...),
    file: UploadFile = File(None),
    resume_text: str = Form(None),
):
    text = ""

    if file and file.filename:
        filename = file.filename.lower()
        suffix = ".pdf" if filename.endswith(".pdf") else ".docx"
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
            tmp.write(await file.read())
            tmp_path = tmp.name
        try:
            text = extract_text_from_pdf(tmp_path) if suffix == ".pdf" else extract_text_from_docx(tmp_path)
        finally:
            os.unlink(tmp_path)

    elif resume_text:
        text = resume_text

    if not text or len(text.strip()) < 50:
        raise HTTPException(
            status_code=422,
            detail="Resume text too short or unreadable. Send a valid PDF/DOCX or resume_text with 50+ characters."
        )

    try:
        return analyze_pipeline(text, role)
    except Exception as e:
        print(f"ANALYSIS ERROR: {type(e).__name__}: {e}")
        raise HTTPException(status_code=500, detail=f"Analysis failed: {str(e)}")


@app.post("/chat", response_model=ChatResponse)
async def chat(req: ChatRequest):
    try:
        reply = get_chat_reply(req.message, req.role)
        return ChatResponse(reply=reply)
    except Exception as e:
        print(f"CHAT ERROR: {e}")
        return ChatResponse(reply="I am here to help with your career! Ask me about skills, projects, courses, or interview tips.")


if __name__ == "__main__":
    port = int(os.getenv("PORT", 8000))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True)
