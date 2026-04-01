const express = require('express');
const router = express.Router();
const path = require('path');

const upload = require('../config/multer');
const { extractTextFromFile, cleanupFile } = require('../services/fileParser');
const { analyzeResume } = require('../services/mlService');
const { getMockResultByRole } = require('../services/mockData');

/**
 * POST /api/resume/upload
 * (The '/api/resume' part comes from server.js)
 */
router.post('/upload', upload.single('resume'), async (req, res, next) => {
  const filePath = req.file?.path;

  try {
    // 1. Validation
    if (!req.file) {
      return res.status(400).json({
        error: 'No file uploaded. Please attach a PDF or DOCX resume.',
      });
    }

    const role = (req.body.role || '').trim();
    if (!role) {
      if (filePath) cleanupFile(filePath);
      return res.status(400).json({ error: 'Target role is required.' });
    }

    const useMock = req.body.useMock === 'true';

    // 2. Dev / mock mode
    if (useMock || process.env.USE_MOCK === 'true') {
      if (filePath) cleanupFile(filePath);
      const result = getMockResultByRole(role);
      return res.json({ success: true, role, source: 'mock', result });
    }

    // 3. Extract text from resume
    let resumeText;
    try {
      resumeText = await extractTextFromFile(filePath);
    } catch (parseErr) {
      if (filePath) cleanupFile(filePath);
      return res.status(422).json({
        error: `Could not parse resume file: ${parseErr.message}`,
      });
    }

    if (!resumeText || resumeText.trim().length < 50) {
      if (filePath) cleanupFile(filePath);
      return res.status(422).json({
        error: 'Resume appears to be empty or unreadable. Please upload a text-based PDF or DOCX.',
      });
    }

    // 4. Call ML API
    let result;
    let source = 'ml';

    try {
      result = await analyzeResume(resumeText, role);
    } catch (mlErr) {
      console.warn('[ML API] Failed, falling back to mock data:', mlErr.message);
      result = getMockResultByRole(role);
      source = 'mock-fallback';
    }

    // 5. Cleanup temp file
    if (filePath) cleanupFile(filePath);

    return res.json({ success: true, role, source, result });

  } catch (err) {
    if (filePath) cleanupFile(filePath);
    next(err);
  }
});

/**
 * GET /api/resume/roles
 */
router.get('/roles', (req, res) => {
  const roles = {
    internship: [
      'Frontend Intern', 'Backend Intern', 'Full Stack Intern',
      'ML Intern', 'Data Science Intern', 'DevOps Intern',
      'Android Intern', 'iOS Intern',
    ],
    job: [
      'Frontend Engineer', 'Backend Engineer', 'Full Stack Engineer',
      'ML Engineer', 'Data Scientist', 'DevOps Engineer',
      'Android Developer', 'iOS Developer',
    ],
  };
  res.json(roles);
});

module.exports = router;