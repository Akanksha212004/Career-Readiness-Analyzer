# 🚀 Career Readiness Backend

Node.js + Express backend for the AI Career Readiness Analyzer.

---

## 📁 Folder Structure

```
career-backend/
├── server.js                   # Entry point
├── package.json
├── .env.example                # Copy to .env and fill in
│
├── config/
│   └── multer.js               # File upload config (PDF/DOCX, 10MB limit)
│
├── routes/
│   ├── resume.js               # POST /api/upload-resume  GET /api/roles
│   ├── chat.js                 # POST /api/chat
│   └── health.js               # GET  /api/health
│
├── services/
│   ├── fileParser.js           # Extract text from PDF / DOCX
│   ├── mlService.js            # Call FastAPI ML API + normalize response
│   ├── chatService.js          # Call FastAPI chatbot
│   └── mockData.js             # Fallback mock results (mirrors frontend)
│
├── middleware/
│   └── errorHandler.js         # Global error handler
│
├── uploads/                    # Temp files (auto-cleaned after processing)
└── ml_service_reference.py     # Reference FastAPI ML implementation
```

---

## ⚡ Quick Start

### 1. Install dependencies
```bash
cd career-backend
npm install
```

### 2. Configure environment
```bash
cp .env.example .env
# Edit .env — set ML_API_URL to your FastAPI service
```

### 3. Run the backend
```bash
# Development (auto-reload)
npm run dev

# Production
npm start
```

Backend runs on **http://localhost:5000**

---

## 🐍 FastAPI ML Service (optional but recommended)

A reference FastAPI implementation is included at `ml_service_reference.py`.

```bash
pip install fastapi uvicorn pydantic
uvicorn ml_service_reference:app --reload --port 8000
```

> If the ML API is **offline**, the backend automatically falls back to mock data — the frontend will still work perfectly.

---

## 📡 API Endpoints

### `POST /api/upload-resume`
Upload a resume and get AI analysis.

**Request** (multipart/form-data):
| Field    | Type   | Required | Description                        |
|----------|--------|----------|------------------------------------|
| file     | File   | ✅       | Resume (.pdf or .docx, max 10MB)   |
| role     | string | ✅       | Target role (e.g. "Frontend Intern")|
| useMock  | string | ❌       | Pass `"true"` to force mock data   |

**Response** (matches `AnalysisResult` from `useCareerStore`):
```json
{
  "success": true,
  "role": "Frontend Intern",
  "source": "ml",
  "result": {
    "overallScore": 68,
    "atsScore": 72,
    "skillMatch": 65,
    "breakdown": { "skills": 70, "projects": 60, "experience": 55, "education": 80 },
    "extractedSkills": ["HTML", "CSS", "React", "Git"],
    "missingSkills": ["TypeScript", "Jest", "Next.js"],
    "recommendations": ["..."],
    "suggestedProjects": ["..."],
    "courses": [{ "title": "...", "platform": "...", "link": "...", "duration": "..." }],
    "jobs": [{ "role": "...", "company": "...", "location": "...", "applyLink": "..." }],
    "explanations": [{ "area": "...", "issue": "...", "suggestion": "...", "severity": "high" }],
    "confidenceLevel": 87
  }
}
```

---

### `POST /api/chat`
Career chatbot.

**Request** (JSON):
```json
{
  "message": "How do I improve my ATS score?",
  "role": "Frontend Intern",
  "history": [
    { "role": "user", "content": "Hello" },
    { "role": "assistant", "content": "Hi! How can I help?" }
  ]
}
```

**Response**:
```json
{ "success": true, "reply": "Use standard headings and keyword-match the job description..." }
```

---

### `GET /api/health`
Check backend + ML API status.

**Response**:
```json
{
  "status": "ok",
  "timestamp": "2025-01-01T00:00:00.000Z",
  "services": { "backend": "online", "mlApi": "online" }
}
```

---

### `GET /api/roles`
Returns supported roles list.

---

## 🔌 Frontend Integration

Update your frontend's `handleAnalyze` function:

```typescript
// src/pages/Index.tsx
const handleAnalyze = async () => {
  if (!selectedRole) return alert("Select role");
  if (!file) return alert("Upload a resume");          // use actual File object

  const formData = new FormData();
  formData.append('file', file);                       // File object from input
  formData.append('role', selectedRole);

  startAnalysis();                                     // sets isAnalyzing = true

  try {
    const res = await fetch('http://localhost:5000/api/upload-resume', {
      method: 'POST',
      body: formData,
    });
    const data = await res.json();

    if (!res.ok) throw new Error(data.error);
    setResult(data.result);                            // matches AnalysisResult
    navigate('/dashboard');
  } catch (err) {
    setError(err.message);
  }
};
```

---

## 🛡️ Error Handling

| Scenario                  | HTTP Status | Response                            |
|---------------------------|-------------|-------------------------------------|
| No file uploaded          | 400         | `{ error: "No file uploaded..." }`  |
| Invalid file type         | 415         | `{ error: "Only PDF and DOCX..." }` |
| File too large            | 413         | `{ error: "File too large..." }`    |
| Empty/unreadable resume   | 422         | `{ error: "Resume appears..." }`    |
| ML API down               | 200 ✅      | Falls back to mock data             |
| Server error              | 500         | `{ error: "..." }`                  |

---

## 🌍 Environment Variables

| Variable         | Default                   | Description                    |
|------------------|---------------------------|--------------------------------|
| `PORT`           | `5000`                    | Express server port            |
| `FRONTEND_URL`   | `http://localhost:5173`   | CORS allowed origin            |
| `ML_API_URL`     | `http://localhost:8000`   | FastAPI ML service URL         |
| `USE_MOCK`       | —                         | Set `true` to always use mock  |
| `MAX_FILE_SIZE_MB`| `10`                     | Max upload size in MB          |
