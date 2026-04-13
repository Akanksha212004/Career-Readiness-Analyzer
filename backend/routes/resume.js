const express = require('express');
const router = express.Router();
const axios = require('axios');
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
  if (!roleName || roleName.length < 3) return;
  try {
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
 * GET /api/resume/roles/search
 * Fix: Suggestions logic working with DB + Python
 */
router.get('/roles/search', async (req, res) => {
  try {
    const { q, type } = req.query; 

    // Kam se kam 2 characters par hi search start karein
    if (!q || q.trim().length < 2) {
      return res.json([]);
    }

    const searchTerm = q.trim();
    const searchType = type || 'job';

    // 1. Database (MongoDB) Search
    let dbResults = await Role.find({
      category: searchType, 
      title: { $regex: searchTerm, $options: 'i' } 
    }).limit(10).lean();

    // 2. Python ML-Service Search
    let mlSuggestions = [];
    try {
      // Encode query for special characters/spaces
      const mlResponse = await axios.get(`http://localhost:8000/roles/suggest?q=${encodeURIComponent(searchTerm)}`);
      
      if (Array.isArray(mlResponse.data)) {
        mlSuggestions = mlResponse.data.map(title => ({
          title: title,
          category: searchType,
          isExpert: true 
        }));
      }
    } catch (mlErr) {
      console.warn("ML Suggestion service down, using only DB results.");
    }

    // 3. Merge Both & Remove Duplicates
    const combinedResults = [...mlSuggestions, ...dbResults];
    
    // Map object to ensure uniqueness by title
    const uniqueMap = new Map();
    combinedResults.forEach(item => {
      const key = item.title.toLowerCase().trim();
      if (!uniqueMap.has(key)) {
        uniqueMap.set(key, item);
      }
    });

    const finalResults = Array.from(uniqueMap.values()).slice(0, 10);
    res.json(finalResults);

  } catch (err) {
    console.error("Search Error:", err.message);
    res.status(500).json({ error: "Roles dhundne mein problem hui" });
  }
});

/**
 * POST /api/resume/upload
 */
router.post('/upload', upload.single('resume'), async (req, res, next) => {
  const filePath = req.file?.path;
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded.' });
    }

    const role = (req.body.role || '').trim();
    const type = req.body.type || 'job';

    if (!role) {
      if (filePath) cleanupFile(filePath);
      return res.status(400).json({ error: 'Target role is required.' });
    }

    learnNewRole(role, type);

    const useMock = req.body.useMock === 'true';
    if (useMock || process.env.USE_MOCK === 'true') {
      if (filePath) cleanupFile(filePath);
      const result = getMockResultByRole(role);
      return res.json({ success: true, role, source: 'mock', result });
    }

    let resumeText = await extractTextFromFile(filePath);
    if (!resumeText || resumeText.trim().length < 50) {
      if (filePath) cleanupFile(filePath);
      return res.status(422).json({ error: 'Resume unreadable.' });
    }

    let result = await analyzeResume(resumeText, role);
    if (filePath) cleanupFile(filePath);

    return res.json({ success: true, role, source: 'ml', result });

  } catch (err) {
    if (filePath) cleanupFile(filePath);
    next(err);
  }
});

module.exports = router;