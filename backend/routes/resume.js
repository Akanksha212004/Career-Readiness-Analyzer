const express = require('express');
const router = express.Router();
const path = require('path');

const upload = require('../config/multer');
const { extractTextFromFile, cleanupFile } = require('../services/fileParser');
const { analyzeResume } = require('../services/mlService');
const { getMockResultByRole } = require('../services/mockData');

/**
 * POST /api/upload-resume
 *
 * Accepts:  multipart/form-data
 *   - file  : resume file (.pdf or .docx)
 *   - role  : target role string (e.g. "Frontend Intern")
 *   - useMock : (optional) "true" to force mock data (dev/testing)
 *
 * Returns: AnalysisResult matching useCareerStore interface
 */
router.post('/upload-resume', upload.single('file'), async (req, res, next) => {
  const filePath = req.file?.path;

  try {
    // ── Validation ─────────────────────────────────────────────
    if (!req.file) {
      return res.status(400).json({
        error: 'No file uploaded. Please attach a PDF or DOCX resume.',
      });
    }

    const role = (req.body.role || '').trim();
    if (!role) {
      cleanupFile(filePath);
      return res.status(400).json({ error: 'Target role is required.' });
    }

    const useMock = req.body.useMock === 'true';

    // ── Dev / mock mode ────────────────────────────────────────
    if (useMock || process.env.USE_MOCK === 'true') {
      cleanupFile(filePath);
      const result = getMockResultByRole(role);
      return res.json({ success: true, role, source: 'mock', result });
    }

    // ── Extract text from resume ───────────────────────────────
    let resumeText;
    try {
      resumeText = await extractTextFromFile(filePath);
    } catch (parseErr) {
      cleanupFile(filePath);
      return res.status(422).json({
        error: `Could not parse resume file: ${parseErr.message}`,
      });
    }

    if (!resumeText || resumeText.trim().length < 50) {
      cleanupFile(filePath);
      return res.status(422).json({
        error: 'Resume appears to be empty or unreadable. Please upload a text-based PDF or DOCX.',
      });
    }

    // ── Call ML API ────────────────────────────────────────────
    let result;
    let source = 'ml';

    try {
      result = await analyzeResume(resumeText, role);
    } catch (mlErr) {
      console.warn('[ML API] Failed, falling back to mock data:', mlErr.message);
      result = getMockResultByRole(role);
      source = 'mock-fallback';
    }

    // ── Cleanup temp file ──────────────────────────────────────
    cleanupFile(filePath);

    return res.json({ success: true, role, source, result });

  } catch (err) {
    cleanupFile(filePath);
    next(err);
  }
});

/**
 * GET /api/roles
 * Returns the list of supported roles (mirrors frontend roles.ts).
 */
router.get('/roles', (req, res) => {
  const roles = {
    internship: [
      'Frontend Intern',
      'Backend Intern',
      'Full Stack Intern',
      'ML Intern',
      'Data Science Intern',
      'DevOps Intern',
      'Android Intern',
      'iOS Intern',
    ],
    job: [
      'Frontend Engineer',
      'Backend Engineer',
      'Full Stack Engineer',
      'ML Engineer',
      'Data Scientist',
      'DevOps Engineer',
      'Android Developer',
      'iOS Developer',
    ],
  };
  res.json(roles);
});

module.exports = router;
