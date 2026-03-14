const mongoose = require('mongoose');

const gamePlayerSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  seatIndex: { type: Number, required: true },
  isReady: { type: Boolean, default: false },
  isConnected: { type: Boolean, default: true }
}, { _id: false });

const gameSchema = new mongoose.Schema({
  roomCode: { type: String, required: true, unique: true, index: true },
  visibility: {
    type: String,
    enum: ['private', 'friends', 'public'],
    default: 'private'
  },
  host: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  ruleset: { type: mongoose.Schema.Types.ObjectId, ref: 'Ruleset', default: null },
  players: [gamePlayerSchema],
  status: {
    type: String,
    enum: ['waiting', 'playing', 'finished'],
    default: 'waiting'
  },
  state: {
    phase: { type: String, default: 'lobby' },
    dealerIndex: { type: Number, default: 0 },
    currentTurnIndex: { type: Number, default: 0 },
    mainSuit: { type: String, default: null },
    currentHand: { type: [mongoose.Schema.Types.Mixed], default: [] },
    collectedHands: { type: [mongoose.Schema.Types.Mixed], default: [] },
    playerHands: { type: mongoose.Schema.Types.Mixed, default: {} },
    points: { type: mongoose.Schema.Types.Mixed, default: {} },
    totalPoints: { type: mongoose.Schema.Types.Mixed, default: {} },
    sharedSnapshot: { type: mongoose.Schema.Types.Mixed, default: {} }
  }
}, { timestamps: true });

module.exports = mongoose.model('Game', gameSchema);
