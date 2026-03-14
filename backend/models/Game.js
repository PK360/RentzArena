const mongoose = require('mongoose');

const gameSchema = new mongoose.Schema({
  roomId: { type: String, required: true, unique: true },
  hostId: { type: String, required: true }, // Changed to String temporarily for mock Auth
  rulesetId: { type: String }, // optional string
  players: [{ type: String }], // Changed to string for mock Auth
  state: {
    status: { type: String, enum: ['waiting', 'playing', 'finished'], default: 'waiting' },
    hands: [], // History of hands collected
    cards: {}, // Map of player to cards
    points: {}, // Map of player to points
    snapshot: {} // The current context evaluated by the Rules Engine
  }
}, { timestamps: true });

module.exports = mongoose.model('Game', gameSchema);
