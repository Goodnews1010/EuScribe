const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const User = require('../models/User');
const Document = require('../models/Document');
const os = require('os');

// ── Admin guard middleware ──
// Only allows users whose email is in the ADMIN_EMAILS env variable
function adminOnly(req, res, next) {
  const adminEmails = (process.env.ADMIN_EMAILS || '').split(',').map(e => e.trim());
  if (!adminEmails.includes(req.user.email)) {
    return res.status(403).json({ message: 'Admin access required' });
  }
  next();
}

// All admin routes require auth + admin role
router.use(auth, adminOnly);

// GET /api/admin/stats — overview numbers
router.get('/stats', async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    const totalDocs = await Document.countDocuments();

    // Signups in last 7 days
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const newUsers = await User.countDocuments({ createdAt: { $gte: sevenDaysAgo } });
    const newDocs = await Document.countDocuments({ createdAt: { $gte: sevenDaysAgo } });

    // Signups per day for last 7 days
    const signupsPerDay = await User.aggregate([
      { $match: { createdAt: { $gte: sevenDaysAgo } } },
      { $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
        count: { $sum: 1 }
      }},
      { $sort: { _id: 1 } }
    ]);

    // System health
    const uptime = process.uptime();
    const memUsage = process.memoryUsage();
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const cpuLoad = os.loadavg()[0];

    res.json({
      totalUsers,
      totalDocs,
      newUsers,
      newDocs,
      signupsPerDay,
      system: {
        uptime: Math.floor(uptime),
        memUsedMB: Math.round(memUsage.rss / 1024 / 1024),
        memTotalMB: Math.round(totalMem / 1024 / 1024),
        memFreeMB: Math.round(freeMem / 1024 / 1024),
        cpuLoad: cpuLoad.toFixed(2),
        nodeVersion: process.version,
        platform: os.platform(),
      }
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/admin/users — all users
router.get('/users', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const search = req.query.search || '';

    const query = search
      ? { $or: [
          { name: { $regex: search, $options: 'i' } },
          { email: { $regex: search, $options: 'i' } }
        ]}
      : {};

    const total = await User.countDocuments(query);
    const users = await User.find(query)
      .select('-password')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    // Get doc count per user
    const userIds = users.map(u => u._id);
    const docCounts = await Document.aggregate([
      { $match: { userId: { $in: userIds } } },
      { $group: { _id: '$userId', count: { $sum: 1 } } }
    ]);

    const docCountMap = {};
    docCounts.forEach(d => { docCountMap[d._id.toString()] = d.count; });

    const usersWithDocs = users.map(u => ({
      ...u.toObject(),
      docCount: docCountMap[u._id.toString()] || 0
    }));

    res.json({ users: usersWithDocs, total, page, pages: Math.ceil(total / limit) });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// DELETE /api/admin/users/:id — delete a user and their documents
router.delete('/users/:id', async (req, res) => {
  try {
    await Document.deleteMany({ userId: req.params.id });
    await User.findByIdAndDelete(req.params.id);
    res.json({ message: 'User and their documents deleted' });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/admin/documents — all documents
router.get('/documents', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const search = req.query.search || '';

    const query = search
      ? { title: { $regex: search, $options: 'i' } }
      : {};

    const total = await Document.countDocuments(query);
    const docs = await Document.find(query)
      .sort({ updatedAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('userId', 'name email');

    res.json({ documents: docs, total, page, pages: Math.ceil(total / limit) });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// DELETE /api/admin/documents/:id — delete a document
router.delete('/documents/:id', async (req, res) => {
  try {
    await Document.findByIdAndDelete(req.params.id);
    res.json({ message: 'Document deleted' });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;