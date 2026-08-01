# 🚀 Career Readiness Analyzer

An AI-powered Career Readiness Evaluation Platform built using the MERN Stack and Machine Learning.

The application analyzes a student's resume against internship and job role requirements to evaluate career readiness. It performs ATS-based resume analysis, identifies skill gaps, calculates readiness scores, and provides personalized learning recommendations, project suggestions, and career guidance using NLP and Machine Learning techniques. :contentReference[oaicite:2]{index=2}

---

## ✨ Features

- 🤖 AI & ML Powered Resume Analysis
- 📄 Resume Upload (PDF/DOCX)
- 🎯 Internship & Job Role Evaluation
- 📊 ATS Resume Score
- 📈 Internship Readiness Score
- 💼 Job Readiness Score
- 🧠 NLP-Based Resume Processing
- 🔍 Skill Extraction & Skill Matching
- 📉 Skill Gap Analysis
- 💡 Personalized Improvement Suggestions
- 🛣️ Learning Roadmap Recommendation
- 💻 Project Recommendations
- 📊 Interactive Career Dashboard
- 🔐 JWT Authentication
- 🍪 Secure Cookie-Based Login
- 📂 Resume Analysis History

---

## 🛠 Tech Stack

### Frontend
- React.js
- React Router
- Axios
- CSS

### Backend
- Node.js
- Express.js
- MongoDB
- Mongoose

### Machine Learning
- Python
- Scikit-learn
- TF-IDF Vectorization
- Cosine Similarity
- NLP (Tokenization, Stop-word Removal, Lemmatization)

### Authentication
- JWT
- HTTP Only Cookies

---

## 📂 Project Structure

```text
Career-Readiness-Analyzer
│
├── backend
│   ├── config
│   ├── controllers
│   ├── middleware
│   ├── models
│   ├── routes
│   ├── services
│   └── server.js
│
├── frontend
│   ├── src
│   ├── components
│   ├── pages
│   ├── hooks
│   └── App.jsx
│
├── ml-service
│   ├── models
│   ├── datasets
│   ├── utils
│   └── app.py
│
└── README.md
```

---

## ⚙️ How It Works

1. Upload Resume (PDF/DOCX)
2. Extract Resume Text
3. Apply NLP Preprocessing
   - Lowercase Conversion
   - Tokenization
   - Stop-word Removal
   - Lemmatization
4. Extract Technical Skills
5. Compare Resume with Internship/Job Dataset
6. Calculate ATS Score using TF-IDF & Cosine Similarity
7. Compute Career Readiness Score
8. Identify Missing Skills
9. Generate Personalized Recommendations
10. Display Results on Interactive Dashboard

---

## ⚙️ Installation

### Clone Repository

```bash
git clone https://github.com/Akanksha212004/Career-Readiness-Analyzer.git
```

### Install Backend

```bash
cd backend
npm install
```

### Install Frontend

```bash
cd frontend
npm install
```

### Install ML Service

```bash
cd ml-service
pip install -r requirements.txt
```

---

## 🔑 Environment Variables

Create a `.env` file inside the **backend** folder.

```env
PORT=5000

MONGODB_URI=your_mongodb_connection

JWT_SECRET=your_secret_key

ML_SERVICE_URL=http://localhost:8000
```

---

## ▶️ Run the Project

### Start Backend

```bash
cd backend
npm run dev
```

### Start Frontend

```bash
cd frontend
npm run dev
```

### Start ML Service

```bash
cd ml-service
python app.py
```

---

## 🧠 Machine Learning Workflow

- Resume Text Extraction
- NLP Preprocessing
- Skill Extraction
- TF-IDF Vectorization
- Cosine Similarity
- ATS Score Calculation
- Internship Readiness Score
- Job Readiness Score
- Skill Gap Identification
- Personalized Recommendation Generation

---

## 📈 Future Improvements

- 🤖 LLM-based Career Guidance
- 📄 AI Resume Generator
- 🎤 AI Mock Interview
- 🌐 Multi-language Resume Support
- 📊 Advanced Analytics Dashboard
- 📱 Mobile Responsive UI
- ☁️ Cloud Deployment
- 📧 Email Career Reports

---

## 👩‍💻 Authors

**Akanksha Yadav**

**Anjali Jaiswal**

---

## ⭐ Support

If you found this project useful, please consider giving it a ⭐ on GitHub.
