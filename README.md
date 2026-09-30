# Career Readiness Analyzer

A student-centric platform that evaluates resumes against internship and job-role
requirements using NLP/ML, gives a weighted readiness score, identifies skill gaps,
flags ATS-formatting issues, and suggests concrete improvements.

The system is split into three independent services:

```
career-readiness-analyzer/
├── frontend/     Next.js (App Router) + TypeScript — the web UI
├── backend/      Node.js + Express — orchestration API (uploads, MongoDB, history)
└── ai-service/   Python + FastAPI — the NLP/ML engine
```

**Data flow:** `frontend → backend → ai-service`. The frontend never calls
ai-service directly.

---

## 1. Prerequisites

| Tool | Version |
|---|---|
| Node.js | ≥ 18 |
| Python | ≥ 3.10 |
| MongoDB | local install or a free [MongoDB Atlas](https://www.mongodb.com/atlas) cluster |

---

## 2. ai-service (Python + FastAPI) — start this first

```bash
cd ai-service
python3 -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env             # defaults work for local dev, edit if needed
uvicorn app.main:app --reload --port 8000
```

Runs on **http://localhost:8000**. Interactive API docs at `/docs`.

**Note on first run:** the semantic-matching model (`sentence-transformers/all-MiniLM-L6-v2`,
~90MB) downloads automatically from Hugging Face the first time you analyze a resume.
This needs a working internet connection once; after that it's cached locally
(`~/.cache/huggingface`). If it's ever unreachable, the service degrades
gracefully to fuzzy/exact skill matching only rather than crashing.

Health check: `curl http://localhost:8000/health`

---

## 3. backend (Node.js + Express)

```bash
cd backend
npm install
cp .env.example .env
# edit .env: set MONGODB_URI to your local Mongo instance or Atlas connection string
npm run dev      # nodemon, auto-restarts on change
# or: npm start
```

Runs on **http://localhost:5000** (configurable via `PORT` in `.env`).

Health check: `curl http://localhost:5000/health` — this also reports whether
it can reach ai-service, which is useful for debugging the connection between
the two services.

**MongoDB:** the backend will refuse to start if it can't connect to
`MONGODB_URI` within the configured timeout — check your connection string
and that `mongod` is running (for a local install) or that your Atlas IP
allowlist includes your machine.

---

## 4. frontend (Next.js + TypeScript)

```bash
cd frontend
npm install
cp .env.example .env.local
npm run dev
```

Runs on **http://localhost:3000**.

---

## 5. Run order

Start in this order so each service's dependency is already up:

1. `ai-service` (port 8000)
2. `backend` (port 5000) — needs ai-service reachable, and MongoDB running
3. `frontend` (port 3000) — needs backend reachable

Then open **http://localhost:3000**, upload a PDF or DOCX resume, pick a
target role (or paste a job description), and view your readiness score.

---

## Environment variables reference

### `ai-service/.env`
| Variable | Purpose | Default |
|---|---|---|
| `AI_SERVICE_HOST` / `AI_SERVICE_PORT` | Bind address | `0.0.0.0` / `8000` |
| `ALLOWED_ORIGINS` | CORS allowlist (should just be the backend URL) | `http://localhost:5000` |
| `SEMANTIC_MODEL_NAME` | sentence-transformers model for semantic skill matching | `all-MiniLM-L6-v2` |
| `FUZZY_MATCH_THRESHOLD` | rapidfuzz match threshold (0-100) | `85` |
| `FUZZY_WEIGHT` | Weight of fuzzy vs semantic signal (0-1) | `0.5` |

### `backend/.env`
| Variable | Purpose | Default |
|---|---|---|
| `PORT` | Express server port | `5000` |
| `MONGODB_URI` | MongoDB connection string | — (required) |
| `AI_SERVICE_URL` | Base URL of the ai-service | `http://localhost:8000` |
| `ALLOWED_ORIGINS` | CORS allowlist (frontend URL) | `http://localhost:3000` |
| `MAX_UPLOAD_SIZE_BYTES` | Max resume upload size | `5242880` (5MB) |
| `RATE_LIMIT_WINDOW_MS` / `RATE_LIMIT_MAX_REQUESTS` | Rate limiting on `/api/*` | 15 min / 100 requests |

### `frontend/.env.local`
| Variable | Purpose | Default |
|---|---|---|
| `NEXT_PUBLIC_API_BASE_URL` | Base URL of the backend | `http://localhost:5000` |

---

## Core features

1. Resume upload (PDF/DOCX) with target role selection (internship or entry-level job)
2. NLP preprocessing pipeline: lowercase → tokenize → stopword removal → lemmatize (NLTK)
3. Hybrid skill extraction: exact/fuzzy matching (rapidfuzz) **+** semantic similarity
   (sentence-transformers) — combined, not TF-IDF alone
4. Resume-vs-specific-JD comparison mode — paste a real job description instead of
   picking from the curated role dataset
5. Weighted Career Readiness Score: Skills 40% + Projects 25% + Experience 20% +
   Education 15%, normalized 0–100
6. Skill-gap identification with personalized suggestions (skills to learn, project
   ideas, resume rewrite tips)
7. ATS-friendliness checker — flags tables, embedded images, non-standard fonts,
   multi-column layouts, and missing standard sections
8. Interactive dashboard with Recharts visualizations (score gauge, breakdown bars,
   skill match lists)
9. Resume version history / progress tracking — every analysis attempt is stored in
   MongoDB so a student can see their score trend over time

## Data integrity note

No mock, dummy, or placeholder data is used anywhere. Every score, skill match, and
dashboard value comes from actually processing an uploaded resume through the real
pipeline. The one dataset that's seeded by design — the role-skill requirement
reference data in `ai-service/app/data/role_dataset.py` — reflects genuinely
researched, standard requirements for each role (compiled from recurring patterns
across real internship/entry-level postings and standard curricula), not filler text.

## Tech stack

| Layer | Stack |
|---|---|
| Frontend | Next.js (App Router) · TypeScript · Tailwind CSS · Radix UI primitives · React Hook Form + Zod · TanStack Query · Recharts · lucide-react |
| Backend | Node.js · Express · Multer · pdf-parse · Mammoth · Axios · MongoDB + Mongoose · express-rate-limit |
| AI service | Python · FastAPI · scikit-learn (TF-IDF/cosine) · sentence-transformers · rapidfuzz · NLTK · pdfplumber · python-docx |

## Troubleshooting

- **"The analysis engine is temporarily unavailable"** from the frontend → ai-service
  isn't running or `AI_SERVICE_URL` in `backend/.env` is wrong.
- **Backend won't start / exits immediately** → check `MONGODB_URI`; the backend
  intentionally refuses to boot without a working DB connection.
- **First analysis request is slow** → normal on the very first request while the
  semantic-matching model downloads/loads into memory; subsequent requests are fast.
- **"Only PDF and DOCX files are supported"** → check the file extension; scanned
  image-only PDFs with no selectable text will also fail extraction with a clear error.
