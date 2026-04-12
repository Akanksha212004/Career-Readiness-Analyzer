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

groq_client = Groq(api_key=os.getenv("GROQ_API_KEY"))

# ══════════════════════════════════════════════════════════════════
# MODEL LOADING (runs once at startup)
# ══════════════════════════════════════════════════════════════════
print("Loading spaCy model...")
nlp_model = spacy.load("en_core_web_md")
print("spaCy loaded")

print("Loading Sentence Transformer model...")
embedder = SentenceTransformer("all-MiniLM-L6-v2")
print("Sentence Transformer loaded")

app = FastAPI(title="Career Readiness ML Service — Moderate Edition")

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
# TOP COMPANIES LIST
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
# HELPER: Clean PDF-extracted text artifacts
# ══════════════════════════════════════════════════════════════════
def clean_pdf_text(text: str) -> str:
    text = re.sub(r"\(cid:\d+\)", " ", text)
    text = re.sub(r"[ \t]{2,}", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


# ══════════════════════════════════════════════════════════════════
# HELPER: Extract a named section from resume text
# ══════════════════════════════════════════════════════════════════
SECTION_HEADINGS = (
    r"education|experience|projects?|technical skills?|skills?|"
    r"certifications?|achievements?|awards?|activities|publications?|"
    r"summary|objective|profile|about"
)

def extract_section(text: str, section_name: str) -> str:
    pattern = re.compile(
        rf"^[ \t]*{re.escape(section_name)}[ \t]*:?[ \t]*\n"
        rf"(.*?)"
        rf"(?=^[ \t]*(?:{SECTION_HEADINGS})[ \t]*:?[ \t]*\n|\Z)",
        re.IGNORECASE | re.MULTILINE | re.DOTALL,
    )
    m = pattern.search(text)
    if m:
        return m.group(1).strip()

    pattern2 = re.compile(
        rf"^[ \t]*{re.escape(section_name)}\b(.*?)"
        rf"(?=^[ \t]*(?:{SECTION_HEADINGS})\b|\Z)",
        re.IGNORECASE | re.MULTILINE | re.DOTALL,
    )
    m2 = pattern2.search(text)
    if m2:
        return m2.group(1).strip()

    return ""


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

    def has_section_heading(keyword_pattern: str) -> bool:
        return bool(re.search(
            rf"^[ \t]*(?:{keyword_pattern})[ \t]*:?\s*$",
            tl, re.IGNORECASE | re.MULTILINE
        ))

    sections = {
        "education":  has_section_heading(r"education|degree|university|college|b\.?tech|bachelor|master")
                      or bool(re.search(r"cgpa|gpa|percentage", tl)),
        "experience": has_section_heading(r"experience|work experience|professional experience"),
        "skills":     has_section_heading(r"skills?|technical skills?|core skills?"),
        "projects":   has_section_heading(r"projects?"),
        "contact":    bool(re.search(r"@[a-z0-9]+\.[a-z]{2,}|linkedin\.com|github\.com|\+\d{7,}", tl)),
        "summary":    has_section_heading(r"summary|objective|about me|profile")
                      or bool(re.search(r"^.{0,200}(b\.?tech|engineering|developer|intern|student).{0,200}$",
                                        tl[:500], re.IGNORECASE | re.MULTILINE)),
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
# HELPER: Detect top company in Experience section only
# ══════════════════════════════════════════════════════════════════
def detect_top_company(text: str) -> tuple[bool, str]:
    """
    Strict matching — searches ONLY inside the EXPERIENCE section.
    Avoids false positives from summary, achievements, certifications.
    """
    tl = text.lower()

    exp_text = extract_section(tl, "experience")
    if not exp_text:
        m = re.search(r"^[ \t]*experience[ \t]*\n", tl, re.IGNORECASE | re.MULTILINE)
        if m:
            exp_text = tl[m.end(): m.end() + 700]
        else:
            print("[EXP] No experience section found at all")
            return False, ""

    print(f"[EXP] Experience section found ({len(exp_text)} chars): {exp_text[:120]!r}")

    # Pattern A: "Amazon – SDE Intern" / "Google | Engineer"
    pattern_a = re.compile(
        r"\b(" + "|".join(re.escape(c) for c in TOP_COMPANIES) + r")\b"
        r"\s*[-–|,at ]{1,6}\s*"
        r".{0,80}"
        r"\b(intern|internship|engineer|developer|analyst|sde|swe|scientist|designer|consultant)\b",
        re.IGNORECASE | re.DOTALL
    )
    # Pattern B: "SDE Intern at Amazon" / "Web Developer, Google"
    pattern_b = re.compile(
        r"\b(intern|internship|engineer|developer|analyst|sde|swe|scientist|designer|consultant)\b"
        r".{0,60}"
        r"\b(" + "|".join(re.escape(c) for c in TOP_COMPANIES) + r")\b",
        re.IGNORECASE | re.DOTALL
    )

    m1 = pattern_a.search(exp_text)
    if m1:
        print(f"[EXP] Tier 1 confirmed (A): {m1.group(1)}")
        return True, m1.group(1)

    m2 = pattern_b.search(exp_text)
    if m2:
        print(f"[EXP] Tier 1 confirmed (B): {m2.group(2)}")
        return True, m2.group(2)

    print("[EXP] No top company found in experience section")
    return False, ""


# ══════════════════════════════════════════════════════════════════
# HELPER: Parse month-year date ranges → total months
# ══════════════════════════════════════════════════════════════════
MONTH_MAP = {
    "jan": 1, "feb": 2, "mar": 3, "apr": 4, "may": 5, "jun": 6,
    "jul": 7, "aug": 8, "sep": 9, "oct": 10, "nov": 11, "dec": 12,
    "january": 1, "february": 2, "march": 3, "april": 4,
    "june": 6, "july": 7, "august": 8, "september": 9,
    "october": 10, "november": 11, "december": 12,
}

def parse_month_year_range(text: str) -> float:
    pattern = re.compile(
        r"(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|"
        r"jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)"
        r"[,.\s]+(\d{4})"
        r"\s*[-–—]\s*"
        r"(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|"
        r"jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?|present|current|now)"
        r"(?:[,.\s]+(\d{4}))?",
        re.IGNORECASE,
    )
    import datetime
    now = datetime.datetime.now()
    total_months = 0.0
    for m in pattern.finditer(text):
        start_month = MONTH_MAP.get(m.group(1).lower()[:3], 1)
        start_year  = int(m.group(2))
        end_str     = m.group(3).lower()[:3]
        end_year_s  = m.group(4)

        if end_str in ("pre", "cur", "now"):
            end_month, end_year = now.month, now.year
        else:
            end_month = MONTH_MAP.get(end_str, start_month)
            end_year  = int(end_year_s) if end_year_s else start_year

        diff = (end_year - start_year) * 12 + (end_month - start_month)
        if diff > 0:
            total_months += diff
            print(f"[DUR] {m.group(0)} → {diff:.0f} months")
    return total_months


def get_duration_months(resume_text: str) -> float:
    """
    Extract total internship/work duration in months.
    Priority: month-year ranges → explicit duration phrases.
    """
    tl = resume_text.lower()
    exp_section = extract_section(tl, "experience") or tl
    total_months = parse_month_year_range(exp_section)

    # Fallback: explicit "6 months", "1 year" phrases
    if total_months == 0:
        pattern = re.compile(
            r"(?<!\d{4}\s)(\d+(?:\.\d+)?)\s*(months?|years?|yrs?|mos?)(?!\s*[-–]\s*\d{4})",
            re.IGNORECASE,
        )
        for match in pattern.finditer(exp_section):
            num  = float(match.group(1))
            unit = match.group(2).lower()
            total_months += num * 12 if ("year" in unit or "yr" in unit) else num

    print(f"[EXP] Total duration detected: {total_months:.1f} months")
    return total_months


# ══════════════════════════════════════════════════════════════════
# ALGORITHM 5: SECTION SCORES + WEIGHTED READINESS
#
# ── EXPERIENCE SCORING TIERS (Moderate & Realistic) ──────────────
#
#  TIER 1 — FAANG / Top branded company  (Amazon, Google, Microsoft, etc.)
#    Base: 70  — brand value is significant; clear gap from unknown companies
#    Duration bonus: up to +18  (honest — 12+ months needed for max)
#    Realistic ceiling: ~88
#    1-month Amazon intern → 70 + 3  = 73
#    4-month Google intern → 70 + 8  = 78
#    6-month top-co intern → 70 + 13 = 83
#    12-month top-co       → 70 + 18 = 88
#
#  TIER 2 — Unknown / mid-size company  (NullClass, local startups, etc.)
#    Base: 32  — real experience but no brand recognition
#    Registered company bonus: +4  (pvt ltd, solutions, labs, etc.)
#    Startup bonus: +3  (early-stage risk deserves small credit)
#    Duration bonus: up to +18
#    Realistic ceiling: ~57
#    3-month NullClass intern    → 32 + 4 + 8  = 44
#    4-month NullClass intern    → 32 + 4 + 8  = 44  (same band)
#    6-month known startup       → 32 + 4 + 3 + 13 = 52
#    Gap vs Tier 1 (1-month Amazon): 73 − 44 = 29 pts  ✓
#
#  TIER 3 — No internship at all
#    Base: 8
#    Freelance/contract: +10
#    Open source: +5
#    Duration bonus: capped at +5 (avoid gaming with vague project dates)
#    Realistic ceiling: ~23
#    No exp, nothing → 8
#    Freelancer (3 months) → 8 + 10 + 5 = 23
#
# ── PROJECT SCORING (Moderate) ───────────────────────────────────
#
#  Uses File 1's strict & honest logic:
#    - GitHub per-project links valued highly
#    - Tutorial clones penalised
#    - Complexity signals add points
#    - Quantified metrics rewarded
#    - No GitHub = penalty (serious red flag in dev roles)
#  But slightly loosened:
#    - Profile-only GitHub gets +8 instead of +5
#    - No live deploy penalty removed (not every project needs hosting)
#    - Complexity per signal gives 5 pts instead of 4
#
# ══════════════════════════════════════════════════════════════════
def calculate_section_scores(resume_text: str, role_data: dict, extracted: list) -> dict:
    tl = resume_text.lower()

    # ── 1. SKILLS SCORE ──────────────────────────────────────────
    skills_score = clamp(int(len(extracted) / max(len(role_data["required"]), 1) * 100))

    # ── 2. EXPERIENCE SCORE ──────────────────────────────────────
    found_top_company, company_name = detect_top_company(resume_text)
    has_internship = bool(re.search(r"\bintern(ship)?\b", tl))
    has_work_exp   = bool(re.search(r"work(ed)?\s+(at|for|with)|employed|full.?time", tl))
    total_months   = get_duration_months(resume_text)

    # ── Duration points (honest, non-inflated scale) ──
    # Reflects real recruiter thinking: 1-2 months is very short
    if total_months >= 12:
        dur_pts = 18
    elif total_months >= 6:
        dur_pts = 13
    elif total_months >= 3:
        dur_pts = 8
    elif total_months >= 1:
        dur_pts = 3   # 1-2 months = minor credit only
    else:
        dur_pts = 0

    if found_top_company:
        # ── TIER 1: FAANG / top branded company ──────────────────
        # Base 70 — clear brand premium; 29+ pt gap over unknown company intern
        # Max reachable: 70 + 18 = 88  (12+ months at top co)
        base = 70
        experience_score = clamp(int(base + dur_pts))
        print(f"[EXP] Tier 1 — Top company ({company_name}), {total_months:.0f} mo → {experience_score}")

    elif has_internship or has_work_exp:
        # ── TIER 2: Regular / unknown / mid-size company ─────────
        # Base 32 — real experience but no brand recognition (NullClass, local startups)
        # Gap vs Tier 1 (1-month Amazon=73): this tier max ~57 — meaningful separation
        base = 32
        # Small bonus for named/registered company (pvt ltd, solutions, labs…)
        if re.search(r"\b(pvt|ltd|inc|solutions|tech|labs|systems|technologies|software)\b", tl):
            base += 4
        # Startup bonus — early-stage joiners deserve small recognition
        if any(re.search(rf"\b{re.escape(kw)}\b", tl) for kw in STARTUP_KEYWORDS):
            base += 3
        experience_score = clamp(int(base + dur_pts))
        print(f"[EXP] Tier 2 — Regular internship, {total_months:.0f} mo → {experience_score}")

    else:
        # ── TIER 3: No internship / no work experience ────────────
        # Base 8 — student with no real experience
        # Duration bonus capped at 5 to avoid gaming with vague project dates
        base = 8
        if bool(re.search(r"freelance|contract|consultant", tl)):
            base += 10
        if "open source" in tl or "contribution" in tl:
            base += 5
        experience_score = clamp(int(base + min(dur_pts, 5)))
        print(f"[EXP] Tier 3 — No experience → {experience_score}")

    # ── 3. PROJECT QUALITY SCORING ───────────────────────────────
    #
    # Honest & moderate — rewards real effort, penalises laziness.
    # Logic from File 1 (strict) but slightly loosened where sensible.
    #
    project_score_val = 0.0

    # (a) Base: project section exists?
    proj_section = extract_section(tl, "projects") or extract_section(tl, "project")
    if proj_section:
        project_score_val += 10
    elif re.search(r"\b(built|developed|implemented|created)\b", tl):
        project_score_val += 5

    # (b) GitHub links — most important signal for dev roles
    per_project_github = len(re.findall(r"github\.com/[a-zA-Z0-9_\-]+/[a-zA-Z0-9_\-]+", tl))
    # Also catch standalone "GitHub" text labels (PDF hyperlink artifacts)
    per_project_github += len(re.findall(r"(?:^|\s)github\s*$", tl, re.MULTILINE | re.IGNORECASE))
    profile_github = bool(re.search(r"github\.com/[a-zA-Z0-9_\-]+", tl))

    if per_project_github >= 2:
        project_score_val += 18   # Multiple project repos — great
    elif per_project_github == 1:
        project_score_val += 12
    elif profile_github:
        project_score_val += 8    # Profile-only link — moderate credit
    else:
        project_score_val -= 5    # No GitHub — red flag, but PDF extraction can miss links

    # (c) Live deployment — rewarded but absence not penalised
    # (Not every project needs to be hosted; no penalty here)
    has_live_deploy = bool(re.search(
        r"\b(vercel|netlify|render\.com|railway|heroku)\b"
        r"|live demo|live link"
        r"|(?:^|\s)live\s*$",
        tl, re.MULTILINE
    ))
    if has_live_deploy:
        project_score_val += 10

    # (d) Tutorial clone penalty
    # "portfolio website" is EXCLUDED — it's expected for students, not a lazy clone.
    # Only penalise clones that are universally over-done (Wanderlust, Netflix, etc.)
    tutorial_clone_count = len(re.findall(
        r"\b(wanderlust|airbnb clone|todo app|to-do app|"
        r"netflix clone|amazon clone|flipkart clone)\b",
        tl, re.IGNORECASE
    ))
    if tutorial_clone_count >= 2:
        project_score_val -= 10   # Multiple lazy clones — not impressive
    elif tutorial_clone_count == 1:
        project_score_val -= 4    # One clone noted, small penalty

    # (e) Technical complexity signals (5 pts each — slightly above File 1's 4)
    complexity_signals = [
        bool(re.search(r"\b(authentication|jwt|oauth|bcrypt|otp)\b", tl)),
        bool(re.search(r"\b(rest api|graphql|websocket|socket\.io|real.?time)\b", tl)),
        bool(re.search(r"\b(docker|kubernetes|ci.?cd|github actions)\b", tl)),
        bool(re.search(r"\b(redis|caching|queue|kafka|celery)\b", tl)),
        bool(re.search(r"\b(typescript|testing|jest|pytest|unit test)\b", tl)),
        bool(re.search(r"\b(machine learning|nlp|ai model|deep learning)\b", tl)),
        bool(re.search(r"\b(payment|stripe|razorpay|cloudinary|twilio)\b", tl)),
    ]
    project_score_val += sum(complexity_signals) * 5   # max 35 pts

    # (f) Quantified impact — huge differentiator
    has_metrics = bool(re.search(
        r"\d[\d,]*\s*\+?\s*(users|stars|downloads|requests|clients|views|uptime|%|ms|kb|mb)",
        tl, re.IGNORECASE
    ))
    if has_metrics:
        project_score_val += 12

    # (g) Project count (from Projects section)
    if proj_section:
        pg = len(re.findall(r"github\.com/[a-zA-Z0-9_\-]+", proj_section))
        pg += len(re.findall(r"(?:^|\s)github\s*$", proj_section, re.MULTILINE | re.IGNORECASE))
        num_proj = max(pg, min(len(re.findall(r"^[ \t]*[A-Z\-]", proj_section, re.MULTILINE)) // 3, 6))
    else:
        num_proj = 0

    if num_proj >= 4:
        project_score_val += 10
    elif num_proj >= 3:
        project_score_val += 7
    elif num_proj >= 2:
        project_score_val += 4
    elif num_proj == 1:
        project_score_val += 1

    # (h) Role-fit signal
    if any(kw in tl for kw in role_data.get("project_signals", [])):
        project_score_val += 5

    projects_score = clamp(int(project_score_val))
    print(f"[PROJ] GitHub={per_project_github} per-project, live={has_live_deploy}, "
          f"clones={tutorial_clone_count}, complexity={sum(complexity_signals)}/7, "
          f"metrics={has_metrics}, num_projects~{num_proj} → {projects_score}")

    # ── 4. EDUCATION SCORE ───────────────────────────────────────
    edu_signals = [
        bool(re.search(r"bachelor|b\.?tech|university|college", tl)),
        bool(re.search(r"cgpa|gpa|percentage", tl)),
    ]
    education_score = (sum(edu_signals) / len(edu_signals)) * 70

    if any(x in tl for x in ["iit", "nit", "bits", "iiit"]):
        education_score += 30

    cgpa_match = re.search(r"cgpa[:\s]+(\d+\.\d+)", tl)
    if cgpa_match:
        cgpa_val = float(cgpa_match.group(1))
        if cgpa_val >= 8.5:
            education_score += 10
        elif cgpa_val >= 8.0:
            education_score += 5

    education_score = clamp(int(education_score))

    return {
        "skills":     skills_score,
        "projects":   projects_score,
        "experience": experience_score,
        "education":  education_score,
    }


def weighted_readiness_score(bd: dict, resume_text: str = "") -> int:
    """
    Weights:
      skills     30% — can you do the job technically?
      experience 35% — have you done it before?
      projects   25% — have you built things independently?
      education  10% — academic baseline

    DSA bonus: small (+4 max) — valued in Indian tech hiring.
    """
    score = (
        0.30 * bd["skills"] +
        0.35 * bd["experience"] +
        0.25 * bd["projects"] +
        0.10 * bd["education"]
    )

    if resume_text:
        tl = resume_text.lower()
        dsa_signals = [
            bool(re.search(r"\b(leetcode|codeforces|codechef|hackerrank|hackerearth)\b", tl)),
            bool(re.search(r"\bsolved\s+\d{2,}\+?\s*(problems?|questions?)\b", tl)),
            bool(re.search(r"\b(rating|rank)\s*[:\-]?\s*\d{3,}\b", tl)),
        ]
        score += sum(dsa_signals) * 1.3   # max ~4 pts

    return clamp(int(score))


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
            if t:
                text += t + "\n"
    return clean_pdf_text(text.strip())

def extract_text_from_docx(path: str) -> str:
    doc = Document(path)
    return "\n".join(p.text for p in doc.paragraphs if p.text.strip())


# ══════════════════════════════════════════════════════════════════
# MAIN ANALYSIS PIPELINE
# ══════════════════════════════════════════════════════════════════
def analyze_pipeline(resume_text: str, role: str) -> dict:
    resume_text = clean_pdf_text(resume_text)
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
    overall = weighted_readiness_score(bd, resume_text)
    print(f"[ML] Breakdown: {bd} | Overall: {overall}")
    explanations = generate_explanations(bd, extracted, missing, ats, semantic_score)
    confidence = clamp(
        50 +
        min(15, len(resume_text.split()) // 40) +  # word count bonus
        (10 if overall > 75 else 5 if overall > 50 else 0) +  # overall score based
        (8 if ats > 70 else 4 if ats > 50 else 0) +           # ats based
        (7 if skill_match > 60 else 3 if skill_match > 30 else 0)  # skill match based
    )

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
    if any(w in msg_l for w in ["hello", "hi", "hey", "help", "start", "what can you"]):      return "greet"
    if any(w in msg_l for w in ["interview", "prepare", "question", "dsa", "leetcode"]):       return "interview"
    if any(w in msg_l for w in ["salary", "package", "ctc", "pay", "stipend"]):                return "salary"
    if any(w in msg_l for w in ["skill", "learn", "missing", "technology", "tech stack"]):     return "skills"
    if any(w in msg_l for w in ["project", "build", "portfolio", "idea", "what to build"]):    return "projects"
    if any(w in msg_l for w in ["course", "resource", "tutorial", "study", "where to learn"]): return "courses"
    if any(w in msg_l for w in ["job", "apply", "company", "intern", "hiring", "career"]):     return "jobs"
    if any(w in msg_l for w in ["ats", "resume", "format", "keyword", "cv", "template"]):      return "ats"
    if any(w in msg_l for w in ["score", "readiness", "rating", "algorithm", "how does"]):     return "score"
    if any(w in msg_l for w in ["github", "open source", "contribution", "repository"]):       return "github"
    return "general"


def get_chat_reply(message: str, role: str) -> str:
    try:
        system_prompt = f"""
You are an expert AI Career Counselor for {role} roles.

Give:
- Practical advice
- Real-world roadmap
- Skills + tools
- Project ideas
- Resume improvement suggestions

Be helpful and slightly conversational.
Avoid generic answers.
"""
        response = groq_client.chat.completions.create(
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user",   "content": message},
            ],
            model="llama-3.3-70b-versatile",
            temperature=0.7,
        )
        return response.choices[0].message.content
    except Exception as e:
        print(f"[CHAT ERROR]: {e}")
        return "I'm here to help! Ask me about skills, projects, or career guidance."


# ══════════════════════════════════════════════════════════════════
# API ROUTES
# ══════════════════════════════════════════════════════════════════

@app.get("/health")
def health():
    return {
        "status": "ok",
        "service": "ml-service — Moderate Edition",
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
