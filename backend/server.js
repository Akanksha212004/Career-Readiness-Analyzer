require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const rateLimit = require('express-rate-limit');

const authRoutes = require('./routes/auth'); 
const authMiddleware = require('./middleware/authMiddleware');
const resumeRoutes = require('./routes/resume');
const chatRoutes = require('./routes/chat');
const healthRoutes = require('./routes/health');
const { errorHandler } = require('./middleware/errorHandler');

const app = express();
const PORT = process.env.PORT || 5000;

// 1. Database
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => {
    console.error('MongoDB Connection Error:', err);
    process.exit(1); 
  });

// 2. CORS - Fixed to allow your frontend port
app.use(cors({
  origin: ['http://localhost:8080', 'http://localhost:8081'],
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// 3. Routes
app.use('/api/auth', authRoutes); 
app.use('/api/health', healthRoutes);

// Protected Routes
app.use('/api/resume', authMiddleware, resumeRoutes); 
app.use('/api/chat', authMiddleware, chatRoutes); 

app.get('/', (req, res) => {
  res.json({ status: 'ok', service: 'Career Readiness Backend' });
});

app.use(errorHandler);
app.use((req, res) => {
  res.status(404).json({ error: `Route ${req.method} ${req.path} not found` });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});