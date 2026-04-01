const express = require('express');
const router = express.Router();
const { register, login } = require('../controllers/authController');

// Define the endpoints
router.post('/register', register);
router.post('/login', login);

module.exports = router;