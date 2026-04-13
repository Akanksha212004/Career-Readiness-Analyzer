const axios = require('axios');
const FormData = require('form-data');

const ML_API_URL = process.env.ML_API_URL || 'http://localhost:8000';
const ML_TIMEOUT_MS = 60000;

async function analyzeResume(resumeText, role) {
  const formData = new FormData();
  formData.append('resume_text', resumeText);
  formData.append('role', role);

  const response = await axios.post(
    `${ML_API_URL}/analyze`,
    formData,
    {
      timeout: ML_TIMEOUT_MS,
      headers: { ...formData.getHeaders() },
    }
  );

  return normalizeMlResponse(response.data);
}

function normalizeMlResponse(data) {
  return {
    overallScore:      clamp(data.overall_score ?? 0),
    atsScore:          clamp(data.ats_score     ?? 0),
    skillMatch:        clamp(data.skill_match   ?? 0),
    breakdown: {
      skills:     clamp(data.breakdown?.skills     ?? 0),
      projects:   clamp(data.breakdown?.projects   ?? 0),
      experience: clamp(data.breakdown?.experience ?? 0),
      education:  clamp(data.breakdown?.education  ?? 0),
    },
    extractedSkills:   toArray(data.extracted_skills),
    missingSkills:     toArray(data.missing_skills),
    recommendations:   toArray(data.recommendations),
    suggestedProjects: toArray(data.suggested_projects),
    courses: toArray(data.courses).map((c) => ({
      title:    c.title    ?? '',
      platform: c.platform ?? '',
      link:     c.link     ?? '#',
      duration: c.duration ?? '',
    })),
    jobs: toArray(data.jobs).map((j) => ({
      role:      j.role      ?? '',
      company:   j.company   ?? '',
      location:  j.location  ?? '',
      applyLink: j.apply_link ?? '#',
    })),
    explanations: toArray(data.explanations).map((e) => ({
      area:       e.area       ?? '',
      issue:      e.issue      ?? '',
      suggestion: e.suggestion ?? '',
      severity:   ['high','medium','low'].includes(e.severity) ? e.severity : 'medium',
    })),
    confidenceLevel: clamp(data.confidence_level ?? 80),
  };
}

const clamp   = (n) => Math.min(100, Math.max(0, Math.round(Number(n) || 0)));
const toArray = (v) => (Array.isArray(v) ? v : []);

module.exports = { analyzeResume };