const express = require('express');
const router = express.Router();
const axios = require('axios');
const auth = require('../middleware/auth');
const User = require('../models/User');
const Document = require('../models/Document');

// Admin middleware
async function adminOnly(req, res, next) {
  try {
    const user = await User.findById(req.user.id);
    if (!user || !user.isAdmin) {
      return res.status(403).json({ message: 'Access denied. Admins only.' });
    }
    next();
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
}

// GET /api/admin/users
router.get('/users', auth, adminOnly, async (req, res) => {
  try {
    const users = await User.find({}).select('-password').sort({ createdAt: -1 });
    res.json(users);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// DELETE /api/admin/users/:id
router.delete('/users/:id', auth, adminOnly, async (req, res) => {
  try {
    await User.findByIdAndDelete(req.params.id);
    await Document.deleteMany({ userId: req.params.id });
    res.json({ message: 'User deleted' });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// PATCH /api/admin/users/:id/promote
router.patch('/users/:id/promote', auth, adminOnly, async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found' });
    // Prevent demoting yourself
    if (user._id.toString() === req.user.id) {
      return res.status(400).json({ message: 'You cannot change your own admin status' });
    }
    user.isAdmin = !user.isAdmin;
    await user.save();
    res.json({ message: `User ${user.isAdmin ? 'promoted to admin' : 'demoted to user'}`, isAdmin: user.isAdmin });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// PATCH /api/admin/users/:id/ban
router.patch('/users/:id/ban', auth, adminOnly, async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found' });
    if (user._id.toString() === req.user.id) {
      return res.status(400).json({ message: 'You cannot ban yourself' });
    }
    user.isBanned = !user.isBanned;
    await user.save();
    res.json({ message: `User ${user.isBanned ? 'banned' : 'unbanned'}`, isBanned: user.isBanned });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/admin/broadcast
router.post('/broadcast', auth, adminOnly, async (req, res) => {
  try {
    const { subject, message } = req.body;
    if (!subject || !message) {
      return res.status(400).json({ message: 'Subject and message are required' });
    }

    const users = await User.find({ isBanned: { $ne: true } }).select('email name');
    if (!users.length) return res.status(400).json({ message: 'No users to send to' });

    const toList = users.map(u => ({ email: u.email, name: u.name || 'EuScribe User' }));

    await axios.post('https://api.brevo.com/v3/smtp/email', {
      sender: { name: 'EuScribe', email: 'aarongoodnews01@gmail.com' },
      to: toList,
      subject: subject,
      htmlContent: `
        <div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;background:#0e0e0f;color:#e6edf3;padding:32px;border-radius:12px">
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:24px">
            <div style="width:32px;height:32px;border-radius:8px;background:#4f8cff;display:flex;align-items:center;justify-content:center;font-weight:800;color:#fff;font-size:14px">E</div>
            <span style="font-size:18px;font-weight:700;color:#e6edf3">EuScribe</span>
          </div>
          <h2 style="color:#4f8cff;margin-bottom:16px;font-size:20px">${subject}</h2>
          <div style="color:#c8d3e6;line-height:1.7;white-space:pre-wrap">${message}</div>
          <hr style="border:none;border-top:1px solid #2e2e40;margin:24px 0"/>
          <p style="color:#555;font-size:12px">You're receiving this because you have a EuScribe account. <a href="https://goodnews1010.github.io/EuScribe/euscribe-frontend/" style="color:#4f8cff">Visit EuScribe</a></p>
        </div>
      `
    }, {
      headers: {
        'api-key': process.env.BREVO_API_KEY,
        'Content-Type': 'application/json'
      }
    });

    res.json({ message: `Broadcast sent to ${users.length} users`, count: users.length });
  } catch (err) {
    console.error(err.response?.data || err.message);
    res.status(500).json({ message: 'Failed to send broadcast' });
  }
});

// GET /api/admin/documents
router.get('/documents', auth, adminOnly, async (req, res) => {
  try {
    const docs = await Document.find({})
      .populate('userId', 'name email')
      .sort({ createdAt: -1 });
    res.json(docs);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;