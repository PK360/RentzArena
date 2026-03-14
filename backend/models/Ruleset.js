const mongoose = require('mongoose');

const rulesetSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String, default: '' },
  author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  type: { type: String, enum: ['per_round', 'end_game'], required: true },
  code: { type: String, required: true },
  tags: { type: [String], default: [] },
  upvoteCount: { type: Number, default: 0 },
  downloadCount: { type: Number, default: 0 },
  isPublic: { type: Boolean, default: false }
}, { timestamps: true });

module.exports = mongoose.model('Ruleset', rulesetSchema);
