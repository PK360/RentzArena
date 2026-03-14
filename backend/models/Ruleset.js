const mongoose = require('mongoose');

const rulesetSchema = new mongoose.Schema({
  title: { type: String, required: true },
  authorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  code: { type: String, required: true }, // The stringified formal rules code
  upvotes: { type: Number, default: 0 },
  type: { type: String, enum: ['per_round', 'end_game'], required: true },
  isPublic: { type: Boolean, default: false } // Determines if available in Marketplace
}, { timestamps: true });

module.exports = mongoose.model('Ruleset', rulesetSchema);
