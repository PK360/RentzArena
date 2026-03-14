const express = require('express');

const Ruleset = require('../../models/Ruleset');
const {
  compileRuleset,
  evaluateIsolatedHands,
  buildRuleSnapshot
} = require('../../engine/evaluator');

const router = express.Router();

router.get('/marketplace', async (_req, res, next) => {
  try {
    const rulesets = await Ruleset.find({ isPublic: true })
      .populate('author', 'displayName friendCode')
      .sort({ upvoteCount: -1, createdAt: -1 })
      .limit(50);

    res.json({ ok: true, rulesets });
  } catch (error) {
    next(error);
  }
});

router.post('/parse', (req, res, next) => {
  try {
    const code = String(req.body.code || '');
    const type = String(req.body.type || 'per_round');
    const ast = compileRuleset(code, type);

    res.json({ ok: true, ast });
  } catch (error) {
    next(error);
  }
});

router.post('/evaluate-preview', (req, res, next) => {
  try {
    const {
      code,
      type = 'per_round',
      playerCount,
      initialPoints = 0,
      handCards = [],
      nonDiscardedCards = []
    } = req.body;

    const snapshot = buildRuleSnapshot({
      playerCount,
      initialPoints,
      handCards,
      nonDiscardedCards
    });

    const result = evaluateIsolatedHands({
      code,
      type,
      evaluations: [{ snapshot }]
    });

    res.json({ ok: true, snapshot, result: result.results[0] });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
