const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');   // ← ADD THIS
const User = require('../models/User');

// Limits: 10 attempts per 15 minutes, per IP address
const authLimiter = rateLimit({                    // ← ADD THIS
  windowMs: 15 * 60 * 1000,                          // 15 minutes
  max: 10,                                           // 10 requests per window
  message: { message: 'Too many attempts. Please try again in 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// POST /api/auth/signup
router.post('/signup', authLimiter, async (req, res) => {   // ← CHANGED
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password)
      return res.status(400).json({ message: 'All fields are required' });

    const exists = await User.findOne({ email });
    if (exists)
      return res.status(400).json({ message: 'Email already registered' });

    const hashed = await bcrypt.hash(password, 10);
    const user = await User.create({ name, email, password: hashed });

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.status(201).json({ token, user: { id: user._id, name: user.name, email: user.email, isAdmin: user.isAdmin } });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/auth/login
router.post('/login', authLimiter, async (req, res) => {    // ← CHANGED
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user)
      return res.status(400).json({ message: 'Invalid credentials' });

    // Block banned users
    if (user.isBanned)
      return res.status(403).json({ message: 'Your account has been suspended. Contact support.' });

    const match = await bcrypt.compare(password, user.password);
    if (!match)
      return res.status(400).json({ message: 'Invalid credentials' });

    // ✅ Track last login
    user.lastLoginAt = new Date();
    await user.save();

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.json({ token,
       user: { id: user._id, name: user.name, email: user.email, isAdmin: user.isAdmin },
        isSuper: user.isSuper
      });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;