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

# Create the Groq AI client
groq_client = Groq(api_key=os.getenv("GROQ_API_KEY"))

app = FastAPI(title="Career Readiness ML Service — Intelligent Edition")

# ── CORS ──────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
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
}

# ── Top Companies List ──────────────────────────────────────────
TOP_COMPANIES = [
    "google", "microsoft", "amazon", "meta", "facebook", "apple", "netflix",
    "openai", "adobe", "uber", "airbnb", "stripe", "shopify", "atlassian",
    "salesforce", "linkedin", "twitter", "snapchat", "pinterest",
    "oracle", "sap", "ibm", "intel", "nvidia", "amd", "cisco",
    "notion", "figma", "canva", "dropbox", "slack", "discord", "zoom",
    "flipkart", "zomato", "swiggy", "paytm", "ola", "razorpay", "cred",
    "meesho", "groww", "zerodha", "freshworks", "postman",
    "tcs", "infosys", "wipro", "hcl", "accenture", "deloitte"
]

STARTUP_KEYWORDS = ["startup", "early stage", "seed", "series a"]

# ══════════════════════════════════════════════════════════════════
# UTILITY FUNCTIONS
# ══════════════════════════════════════════════════════════════════
def clamp(n): return max(0, min(100, n))

def nlp_preprocess_spacy(text: str) -> tuple:
    doc = nlp_model(text[:50000])
    tokens, lemmas = [], []
    for token in doc:
        if not token.is_stop and not token.is_punct and len(token.text) > 1:
            tokens.append(token.text.lower())
            lemmas.append(token.lemma_.lower())
    return tokens, lemmas, doc

def detect_role_key(role: str) -> str:
    r = role.lower()
    if any(k in r for k in ["frontend", "react", "ui", "angular", "vue"]): return "frontend"
    if any(k in r for k in ["backend", "node", "api", "server", "django"]): return "backend"
    if any(k in r for k in ["fullstack", "full stack", "mern", "mean", "full-stack"]): return "fullstack"
    if any(k in r for k in ["ml", "machine", "data", "ai", "deep", "nlp"]): return "ml"
    if any(k in r for k in ["devops", "cloud", "sre", "infrastructure"]): return "devops"
    return "frontend"

# ══════════════════════════════════════════════════════════════════
# SCORING ALGORITHMS
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

def extract_skills_spacy(resume_text: str, required: list) -> tuple:
    tl = resume_text.lower()
    _, lemmas, _ = nlp_preprocess_spacy(resume_text)
    lemma_text = " ".join(lemmas)
    extracted, missing = [], []
    for skill in required:
        skill_l = skill.lower()
        if skill_l in tl or skill_l in lemma_text:
            extracted.append(skill.title())
        else:
            missing.append(skill.title())
    return extracted[:10], missing[:8]

def calculate_semantic_skill_match(resume_text: str, role_data: dict) -> int:
    resume_embedding = embedder.encode(resume_text[:3000], convert_to_tensor=True)
    jd_embedding     = embedder.encode(role_data["jd_text"], convert_to_tensor=True)
    sim = float(util.cos_sim(resume_embedding, jd_embedding)[0][0])
    return clamp(int((sim - 0.1) / 0.6 * 100))

def calculate_tfidf_match(resume_text: str, role_data: dict) -> int:
    try:
        vectorizer = TfidfVectorizer(stop_words="english", ngram_range=(1, 2))
        corpus = [resume_text[:5000], role_data["jd_text"]]
        tfidf_matrix = vectorizer.fit_transform(corpus)
        sim = float(sk_cosine(tfidf_matrix[0], tfidf_matrix[1])[0][0])
        return clamp(int(sim * 100))
    except Exception: return 50

def detect_top_company(text_lower: str) -> tuple:
    for company in TOP_COMPANIES:
        if company in text_lower: return True, company
    return False, ""

def extract_experience_duration_score(text_lower: str) -> int:
    match = re.search(r"(\d+)\s*(months?|years?)", text_lower)
    if match: return 15
    return 0

def calculate_section_scores(resume_text: str, role_data: dict, extracted: list) -> dict:
    tl = resume_text.lower()
    skills_score = clamp(int(len(extracted) / max(len(role_data["required"]), 1) * 100))
    
    found_top, _ = detect_top_company(tl)
    experience_score = 85 if found_top else 45
    
    project_score_val = 20 if "github.com" in tl else 0
    if re.search(r"project|built", tl): project_score_val += 30
    
    education_score = 70 if re.search(r"bachelor|university", tl) else 30
    
    return {
        "skills": skills_score,
        "projects": clamp(project_score_val),
        "experience": experience_score,
        "education": education_score,
    }

def weighted_readiness_score(bd: dict) -> int:
    return clamp(int(0.3*bd["skills"] + 0.25*bd["projects"] + 0.35*bd["experience"] + 0.1*bd["education"]))

def generate_explanations(bd, extracted, missing, ats, semantic_score):
    return [{"area": "Skills", "issue": "Missing key skills", "suggestion": f"Add {', '.join(missing[:3])}"}]

# ══════════════════════════════════════════════════════════════════
# PIPELINE AND TEXT EXTRACTION
# ══════════════════════════════════════════════════════════════════
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

def analyze_pipeline(resume_text: str, role: str) -> dict:
    rk = detect_role_key(role)
    rd = ROLE_DB[rk]
    ats = calculate_ats_score(resume_text, rd)
    extracted, missing = extract_skills_spacy(resume_text, rd["required"])
    sem_score = calculate_semantic_skill_match(resume_text, rd)
    tfidf_score = calculate_tfidf_match(resume_text, rd)
    skill_match = clamp(int(0.6 * sem_score + 0.4 * tfidf_score))
    bd = calculate_section_scores(resume_text, rd, extracted)
    overall = weighted_readiness_score(bd)
    return {
        "overall_score": overall,
        "ats_score": ats,
        "skill_match": skill_match,
        "breakdown": bd,
        "extracted_skills": extracted or ["No skills found"],
        "missing_skills": missing,
        "recommendations": rd["suggestions"],
        "suggested_projects": rd["projects"],
        "courses": rd["courses"],
        "jobs": rd["jobs"],
        "explanations": generate_explanations(bd, extracted, missing, ats, sem_score),
        "confidence_level": 85,
    }

# ══════════════════════════════════════════════════════════════════
# SMART CHATBOT LOGIC (GROQ AI)
# ══════════════════════════════════════════════════════════════════
def get_chat_reply(message: str, role: str) -> str:
    try:
        # Connect to Groq Cloud for Real AI responses
        chat_completion = groq_client.chat.completions.create(
            messages=[
                {
                    "role": "system",
                    "content": f"You are a professional Career Counselor for {role}. Provide expert, detailed, and actionable advice. When asked for better projects or skills, suggest advanced industry-level ideas. Keep the tone helpful and professional."
                },
                {
                    "role": "user",
                    "content": message,
                }
            ],
            model="llama-3.3-70b-versatile",
            temperature=0.7,
        )
        return chat_completion.choices[0].message.content
    except Exception as e:
        print(f"AI Error: {e}")
        return "I'm having trouble connecting to my AI brain. Focus on mastering your core skills and building high-impact projects for now!"

# ══════════════════════════════════════════════════════════════════
# API ROUTES
# ══════════════════════════════════════════════════════════════════
@app.get("/health")
def health():
    return {"status": "ok", "models": ["spaCy md", "Sentence Transformer"]}

@app.post("/analyze")
async def analyze(role: str = Form(...), file: UploadFile = File(None), resume_text: str = Form(None)):
    text = ""
    if file and file.filename:
        suffix = ".pdf" if file.filename.lower().endswith(".pdf") else ".docx"
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
            tmp.write(await file.read())
            tmp_path = tmp.name
        try:
            text = extract_text_from_pdf(tmp_path) if suffix == ".pdf" else extract_text_from_docx(tmp_path)
        finally: os.unlink(tmp_path)
    elif resume_text: text = resume_text

    if not text: raise HTTPException(status_code=422, detail="No resume content.")
    return analyze_pipeline(text, role)

@app.post("/chat", response_model=ChatResponse)
async def chat(req: ChatRequest):
    reply = get_chat_reply(req.message, req.role)
    return ChatResponse(reply=reply)

if __name__ == "__main__":
    port = int(os.getenv("PORT", 8000))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True)