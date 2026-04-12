const express = require('express');
const router = express.Router();
const path = require('path');

const upload = require('../config/multer');
const { extractTextFromFile, cleanupFile } = require('../services/fileParser');
const { analyzeResume } = require('../services/mlService');
const { getMockResultByRole } = require('../services/mockData');
const Role = require('../models/Role');

/**
 * Helper function: Naye role ko seekhna (Self-Learning Logic)
 */
const learnNewRole = async (roleName, roleType) => {
  if (!roleName || roleName.length < 3) return; // Bahut chote words skip karein

  try {
    // Check karein kya ye role pehle se exist karta hai?
    const exists = await Role.findOne({
      title: { $regex: new RegExp(`^${roleName.trim()}$`, 'i') },
      category: roleType
    });

    if (!exists) {
      await Role.create({
        title: roleName.trim(),
        category: roleType || 'job'
      });
      console.log(`New role learned: ${roleName} (${roleType}) ✅`);
    }
  } catch (err) {
    console.error("Error learning new role:", err.message);
  }
};

/**
 * POST /api/resume/upload
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
    const type = req.body.type || 'job'; // Frontend se category (internship/job)

    if (!role) {
      if (filePath) cleanupFile(filePath);
      return res.status(400).json({ error: 'Target role is required.' });
    }

    // --- SELF-LEARNING LOGIC START ---
    // Background mein role save karega taaki analysis slow na ho
    learnNewRole(role, type);
    // --- SELF-LEARNING LOGIC END ---

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
 * GET /api/resume/roles/search
 */
router.get('/roles/search', async (req, res) => {
  try {
    const { q, type } = req.query; 

    // Agar search query khali hai toh empty array bhejien
    if (!q || q.trim().length < 2) {
      return res.json([]);
    }

    // Database mein search logic
    const results = await Role.find({
      category: type, 
      title: { $regex: q, $options: 'i' } 
    }).limit(10);

    res.json(results);
  } catch (err) {
    res.status(500).json({ error: "Roles dhundne mein problem hui" });
  }
});

module.exports = router;