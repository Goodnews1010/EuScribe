const express = require('express');
const router = express.Router();
const passport = require('passport');
const GitHubStrategy = require('passport-github2').Strategy;
const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Configure GitHub Strategy
passport.use(new GitHubStrategy({
  clientID: process.env.GITHUB_CLIENT_ID,
  clientSecret: process.env.GITHUB_CLIENT_SECRET,
  callbackURL: 'https://euscribe.onrender.com/api/auth/github/callback',
  scope: ['user:email']
}, async (accessToken, refreshToken, profile, done) => {
  try {
    const email = profile.emails?.[0]?.value || `${profile.username}@github.com`;
    let user = await User.findOne({ email });

    if (!user) {
      user = await User.create({
        name: profile.displayName || profile.username,
        email: email,
        password: 'github-oauth-' + profile.id
      });
    }

    return done(null, user);
  } catch (err) {
    return done(err, null);
  }
}));

// Start GitHub OAuth
router.get('/', passport.authenticate('github', {
  scope: ['user:email'],
  session: false
}));

// GitHub callback
router.get('/callback',
  passport.authenticate('github', { session: false, failureRedirect: 'https://goodnews1010.github.io/EuScribe/euscribe-frontend/euscribe-auth.html' }),
  (req, res) => {
    const token = jwt.sign({ id: req.user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });
    const name = encodeURIComponent(req.user.name);
    const email = encodeURIComponent(req.user.email);
    res.redirect(`https://goodnews1010.github.io/EuScribe/euscribe-frontend/index.html?token=${token}&name=${name}&email=${email}`);
  }
);

module.exports = router;