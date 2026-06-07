const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const User = require('../models/User');
const Announcement = require('../models/Announcement');

// GET /api/announcement — fetch latest active announcement for this user
router.get('/', auth, async (req, res) => {
  try {
    const ann = await Announcement.findOne({ active: true }).sort({ createdAt: -1 });
    if (!ann) return res.json(null);

    // All users — show to everyone
    if (ann.targetMode === 'all') return res.json(ann);

    // Admins only — check if user is admin
    if (ann.targetMode === 'admins') {
      const user = await User.findById(req.user.id).select('isAdmin');
      if (user && user.isAdmin) return res.json(ann);
      return res.json(null);
    }

    // Custom — check if user is in target list
    if (ann.targetMode === 'custom') {
      const isTarget = ann.targetUserIds.some(id => id.toString() === req.user.id);
      if (isTarget) return res.json(ann);
      return res.json(null);
    }

    res.json(null);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;