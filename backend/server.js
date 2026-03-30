require('dotenv').config();
const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');

const resumeRoutes = require('./routes/resume');
const chatRoutes = require('./routes/chat');
const healthRoutes = require('./routes/health');
const { errorHandler } = require('./middleware/errorHandler');

const app = express();
const PORT = process.env.PORT || 5000;

// ─── 1. CORS ──────────────────────────────────────────────────
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// ─── 2. Body Parsers ──────────────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ─── 3. Rate Limiting ─────────────────────────────────────────
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50,
  message: { error: 'Too many requests, please try again later.' },
});
app.use('/api/', limiter);

// ─── 4. Root ──────────────────────────────────────────────────
app.get('/', (req, res) => {
  res.json({ status: 'ok', service: 'Career Readiness Backend', version: '1.0.0' });
});

// ─── 5. Routes ────────────────────────────────────────────────
app.use('/api', healthRoutes);
app.use('/api', resumeRoutes);
app.use('/api', chatRoutes);

// ─── 6. Error Handler ─────────────────────────────────────────
app.use(errorHandler);

// ─── 7. 404 Catch-all ─────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: `Route ${req.method} ${req.path} not found` });
});

app.listen(PORT, () => {
  console.log(`\n🚀 Career Readiness Backend running on http://localhost:${PORT}`);
  console.log(`📡 ML API URL: ${process.env.ML_API_URL || 'http://localhost:8000'}`);
  console.log(`🌐 Frontend URL: ${process.env.FRONTEND_URL || 'http://localhost:5173'}\n`);
});

module.exports = app;