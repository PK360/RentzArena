const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  friendCode: { type: String, required: true, unique: true }, // short alphanumeric code
  friends: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  savedRulesets: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Ruleset' }],
  magicLinkToken: { type: String },
  magicLinkExpires: { type: Date }
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);
