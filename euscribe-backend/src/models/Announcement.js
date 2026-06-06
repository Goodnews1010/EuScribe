const mongoose = require('mongoose');

const announcementSchema = new mongoose.Schema({
  message: { type: String, required: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  active: { type: Boolean, default: true },
}, { timestamps: true });

module.exports = mongoose.model('Announcement', announcementSchema);