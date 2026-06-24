const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name:     { type: String, required: true },
  email:    { type: String, required: true, unique: true },
  password: { type: String, required: false },
  isAdmin:  { type: Boolean, default: false },
  isSuper: { type: Boolean, default: false },
  isBanned: { type: Boolean, default: false },
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);