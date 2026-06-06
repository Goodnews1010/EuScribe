const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Announcement = require('../models/Announcement');

// GET /api/announcement — fetch latest active announcement
router.get('/', auth, async (req, res) => {
  try {
    const ann = await Announcement.findOne({ active: true }).sort({ createdAt: -1 });
    res.json(ann || null);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;