const express = require('express');
const router  = express.Router();
const axios   = require('axios');

const ML_API_URL = process.env.ML_API_URL || 'http://localhost:8000';

/**
 * POST /api/chat
 * Forwards message + role + history to FastAPI ML chatbot.
 */
router.post('/chat', async (req, res, next) => {
  try {
    const { message, role = '', history = [] } = req.body;

    if (!message || typeof message !== 'string' || !message.trim()) {
      return res.status(400).json({ error: 'message is required.' });
    }

    if (message.trim().length > 2000) {
      return res.status(400).json({ error: 'Message too long (max 2000 chars).' });
    }

    // Sanitize history
    const safeHistory = Array.isArray(history)
      ? history
          .filter((h) => h && ['user', 'assistant'].includes(h.role) && typeof h.content === 'string')
          .slice(-10)
      : [];

    // Forward to ML service
    const mlResponse = await axios.post(
      `${ML_API_URL}/chat`,
      {
        message: message.trim(),
        role:    role.trim(),
        history: safeHistory,
      },
      {
        timeout: 20000,
        headers: { 'Content-Type': 'application/json' },
      }
    );

    const reply = mlResponse.data?.reply || "I'm here to help! Ask me about skills, projects, or career tips.";
    res.json({ success: true, reply });

  } catch (err) {
    console.error('[Chat Route Error]', err.message);

    // Fallback replies if ML service is down
    const fallbacks = [
      'Focus on building real-world projects and contributing to open source.',
      'Make your resume ATS-friendly: use standard headings and include role keywords.',
      'A strong GitHub profile with documented projects can significantly boost your application.',
      'Tailor your resume for each role by highlighting the most relevant skills.',
    ];
    const fallback = fallbacks[Math.floor(Math.random() * fallbacks.length)];
    res.json({ success: true, reply: fallback });
  }
});

module.exports = router;
