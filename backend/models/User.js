const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  displayName: { type: String, required: true, trim: true },
  friendCode: { type: String, required: true, unique: true, index: true },
  emailConfirmedAt: { type: Date, default: null },
  lastSeenAt: { type: Date, default: null },
  friends: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  savedRulesets: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Ruleset' }],
  createdRulesets: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Ruleset' }],
  magicLinkTokenHash: { type: String, default: null },
  magicLinkExpiresAt: { type: Date, default: null }
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);
