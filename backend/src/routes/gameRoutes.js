const express = require('express');

const Game = require('../../models/Game');

const router = express.Router();

router.get('/:roomCode', async (req, res, next) => {
  try {
    const game = await Game.findOne({ roomCode: req.params.roomCode })
      .populate('host', 'displayName friendCode')
      .populate('ruleset', 'title type')
      .populate('players.user', 'displayName friendCode');

    if (!game) {
      return res.status(404).json({ error: 'Game not found' });
    }

    res.json({ ok: true, game });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
