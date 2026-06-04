const express = require('express');
const router = express.Router();
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Configure Google Strategy
passport.use(new GoogleStrategy({
  clientID: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  callbackURL: 'https://euscribe.onrender.com/api/auth/google/callback'
}, async (accessToken, refreshToken, profile, done) => {
  try {
    // Check if user already exists
    let user = await User.findOne({ email: profile.emails[0].value });

    if (!user) {
      // Create new user
      user = await User.create({
        name: profile.displayName,
        email: profile.emails[0].value,
        password: 'google-oauth-' + profile.id // placeholder password
      });
    }

    return done(null, user);
  } catch (err) {
    return done(err, null);
  }
}));

// Start Google OAuth
router.get('/', passport.authenticate('google', {
  scope: ['profile', 'email'],
  session: false
}));

// Google callback
router.get('/callback',
  passport.authenticate('google', { session: false, failureRedirect: 'https://goodnews1010.github.io/EuScribe/euscribe-frontend/euscribe-auth.html' }),
  (req, res) => {
    const token = jwt.sign({ id: req.user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });
    const name = encodeURIComponent(req.user.name);
    const email = encodeURIComponent(req.user.email);

    // Redirect to frontend with token in URL
    res.redirect(`https://goodnews1010.github.io/EuScribe/euscribe-frontend/index.html?token=${token}&name=${name}&email=${email}`);
  }
);

module.exports = router;