const express = require('express');
const router = express.Router();
const axios = require('axios');

/**
 * GET /api/health
 * Returns status of this backend + ML API connectivity.
 */
router.get('/health', async (req, res) => {
  const mlUrl = process.env.ML_API_URL || 'http://localhost:8000';
  let mlStatus = 'unknown';

  try {
    await axios.get(`${mlUrl}/health`, { timeout: 3000 });
    mlStatus = 'online';
  } catch {
    mlStatus = 'offline';
  }

  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    services: {
      backend: 'online',
      mlApi: mlStatus,
    },
  });
});

module.exports = router;
