const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const axios = require('axios');
const User = require('../models/User');

// Store reset tokens in memory
const resetTokens = {};

// POST /api/password/forgot
router.post('/forgot', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: 'Email is required' });

    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ message: 'No account found with that email' });

    const token = crypto.randomBytes(32).toString('hex');
    resetTokens[token] = { email, expires: Date.now() + 15 * 60 * 1000 };

    const resetLink = `https://goodnews1010.github.io/EuScribe/euscribe-frontend/euscribe-auth.html?reset=${token}`;

    await axios.post('https://api.brevo.com/v3/smtp/email', {
      sender: { name: 'EuScribe', email: 'aarogoodnews01@gmail.com' },
      to: [{ email }],
      subject: 'Reset your EuScribe password',
      htmlContent: `
        <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;background:#0e0e0f;color:#e6edf3;padding:32px;border-radius:12px">
          <h2 style="color:#4f8cff;margin-bottom:8px">Reset your password</h2>
          <p style="color:#9aa4b2;margin-bottom:24px">Click the button below to reset your EuScribe password. This link expires in 15 minutes.</p>
          <a href="${resetLink}" style="display:inline-block;padding:12px 24px;background:#4f8cff;color:#fff;border-radius:8px;text-decoration:none;font-weight:700">Reset Password</a>
          <p style="color:#555;margin-top:24px;font-size:12px">If you didn't request this, ignore this email.</p>
        </div>
      `
    }, {
      headers: {
        'api-key': process.env.BREVO_API_KEY,
        'Content-Type': 'application/json'
      }
    });

    res.json({ message: 'Reset link sent to your email' });
  } catch (err) {
    console.error(err.response?.data || err.message);
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
      return res.status(400).json({ message: 'Reset link has expired' });
    }
    if (password.length < 6) return res.status(400).json({ message: 'Password must be at least 6 characters' });

    const hashed = await bcrypt.hash(password, 10);
    await User.findOneAndUpdate({ email: record.email }, { password: hashed });

    delete resetTokens[token];
    res.json({ message: 'Password reset successful' });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;