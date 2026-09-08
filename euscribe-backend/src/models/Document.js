const mongoose = require('mongoose');

const documentSchema = new mongoose.Schema({
  userId:  { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  title:   { type: String, default: 'Untitled Document' },
  content: { type: String, default: '' },
  wordCount: { type: Number, default: 0 },
}, { timestamps: true });

module.exports = mongoose.model('Document', documentSchema);