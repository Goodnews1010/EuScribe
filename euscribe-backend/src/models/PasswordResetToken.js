const mongoose = require('mongoose');

const passwordResetTokenSchema = new mongoose.Schema({
  token: { type: String, required: true, unique: true },
  email: { type: String, required: true },
  expiresAt: { type: Date, required: true },
});

// This tells MongoDB to auto-delete the document once expiresAt passes —
// so expired tokens clean themselves up, no manual deletion needed.
passwordResetTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('PasswordResetToken', passwordResetTokenSchema);