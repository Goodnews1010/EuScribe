const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const bcrypt = require('bcryptjs');
const User = require('../models/User');

// Store reset tokens in memory (will move to DB later)
const resetTokens = {};

// Configure Gmail transporter
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_PASS,
  },
});

// POST /api/password/forgot
router.post('/forgot', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: 'Email is required' });

    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ message: 'No account found with that email' });

    // Generate reset token
    const token = crypto.randomBytes(32).toString('hex');
    const expires = Date.now() + 1000 * 60 * 30; // 30 minutes
    resetTokens[token] = { userId: user._id, expires };

    // Build reset link
    const resetLink = `https://goodnews1010.github.io/EuScribe/euscribe-frontend/euscribe-auth.html?reset=${token}`;

    // Send email
    await transporter.sendMail({
      from: `"EuScribe" <${process.env.GMAIL_USER}>`,
      to: email,
      subject: 'Reset your EuScribe password',
      html: `
        <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;background:#0e0e0f;color:#e0e0e0;padding:32px;border-radius:12px">
          <h2 style="color:#4f8cff;margin-bottom:8px">EuScribe</h2>
          <p style="margin-bottom:20px;color:#999">Password reset request</p>
          <p style="margin-bottom:24px">We received a request to reset your password. Click the button below to set a new one. This link expires in <strong>30 minutes</strong>.</p>
          <a href="${resetLink}" style="display:inline-block;padding:12px 28px;background:#4f8cff;color:#fff;border-radius:8px;text-decoration:none;font-weight:700;font-size:15px">Reset Password</a>
          <p style="margin-top:24px;font-size:12px;color:#555">If you didn't request this, you can safely ignore this email.</p>
        </div>
      `
    });

    res.json({ message: 'Reset link sent to your email' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to send email' });
  }
});

// POST /api/password/reset
router.post('/reset', async (req, res) => {
  try {
    const { token, password } = req.body;
    if (!token || !password) return res.status(400).json({ message: 'Token and password are required' });

    const record = resetTokens[token];
    if (!record) return res.status(400).json({ message: 'Invalid or expired reset link' });
    if (Date.now() > record.expires) {
      delete resetTokens[token];
      return res.status(400).json({ message: 'Reset link has expired. Please request a new one.' });
    }

    const hashed = await bcrypt.hash(password, 10);
    await User.findByIdAndUpdate(record.userId, { password: hashed });
    delete resetTokens[token];

    res.json({ message: 'Password reset successfully' });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;