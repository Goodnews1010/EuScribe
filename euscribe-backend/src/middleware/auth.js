const jwt = require('jsonwebtoken');
const User = require('../models/User');

module.exports = async function(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token)
    return res.status(401).json({ message: 'Access denied. No token provided.' });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;

    // Check if user is banned
    const user = await User.findById(decoded.id).select('isBanned');
    if (user && user.isBanned) {
      return res.status(403).json({ message: 'Your account has been suspended.' });
    }

    next();
  } catch (err) {
    res.status(403).json({ message: 'Invalid or expired token.' });
  }
};