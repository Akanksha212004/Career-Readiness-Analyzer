const User = require('../models/User');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

exports.register = async (req, res) => {
    try {
        const { email, password } = req.body;

        // 1. Check if user already exists BEFORE trying to save
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ error: "Email is already registered" });
        }

        // 2. Hash password
        const hashedPassword = await bcrypt.hash(password, 10);
        
        // 3. Save User
        const newUser = new User({ email, password: hashedPassword });
        await newUser.save();
        
        res.status(201).json({ message: "User registered successfully" });
    } catch (err) {
        console.error("Registration Error Details:", err); // This prints the REAL error in your terminal
        res.status(500).json({ error: "Server error during registration" });
    }
};

exports.login = async (req, res) => {
    try {
        const { email, password } = req.body;
        
        // Ensure JWT_SECRET exists
        if (!process.env.JWT_SECRET) {
            console.error("❌ ERROR: JWT_SECRET is missing in .env file");
            return res.status(500).json({ error: "Server configuration error" });
        }

        const user = await User.findOne({ email });
        if (!user || !(await bcrypt.compare(password, user.password))) {
            return res.status(401).json({ error: "Invalid email or password" });
        }

        const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: '24h' });
        res.json({ token, email: user.email });
    } catch (err) {
        console.error("Login Error:", err);
        res.status(500).json({ error: "Login error" });
    }
};