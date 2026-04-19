const fs = require('fs');
const path = require('path');

const {
  buildRuleSnapshot,
  compileRuleset,
  evaluateRuleWithSnapshot
} = require('../engine/evaluator');
const { parseRootRulesets } = require('./rootRulesetParser');

const baseRuleModules = [
  require('./defaults/kingOfHearts'),
  require('./defaults/diamonds'),
  require('./defaults/queens'),
  require('./defaults/tenOfClubs'),
  require('./defaults/whist')
];

const extraRuleModules = [
  require('./defaults/levate'),
  require('./defaults/totalPlus'),
  require('./defaults/totalMinus')
];

const TOTAL_BASE_RULE_IDS = ['kingOfHearts', 'diamonds', 'queens', 'tenOfClubs', 'whist'];
const ROOT_RULESETS_PATH = path.resolve(__dirname, '../../room_rulesets.txt');

function readRootRulesets() {
  const rawText = fs.readFileSync(ROOT_RULESETS_PATH, 'utf8');
  return parseRootRulesets(rawText);
}

function buildRulesetRegistry() {
  const rootRulesByTitle = new Map(
    readRootRulesets().map((definition) => [definition.label, definition])
  );

  const baseRules = baseRuleModules.map((definition) => {
    const rootRule = rootRulesByTitle.get(definition.sourceTitle);
    if (!rootRule) {
      throw new Error(`Default ruleset '${definition.sourceTitle}' was not found in room_rulesets.txt`);
    }

    return {
      ...definition,
      type: rootRule.type,
      source: 'room_rulesets.txt',
      code: rootRule.code,
      compiled: compileRuleset(rootRule.code, rootRule.type)
    };
  });

  const extraRules = extraRuleModules.map((definition) => ({
    ...definition,
    source: definition.code ? 'module' : 'composite',
    compiled: definition.code ? compileRuleset(definition.code, definition.type) : null
  }));

  const rules = [...baseRules, ...extraRules];

  return Object.freeze(
    Object.fromEntries(rules.map((definition) => [definition.id, Object.freeze(definition)]))
  );
}

const RULESETS = buildRulesetRegistry();
const DEFAULT_RULESET_SELECTIONS = Object.freeze(
  Object.fromEntries(
    Object.values(RULESETS).map((definition) => [
      definition.id,
      Boolean(definition.enabledByDefault)
    ])
  )
);

function getAvailableRulesets() {
  return Object.values(RULESETS).map((definition) => ({
    id: definition.id,
    label: definition.label,
    abbreviation: definition.abbreviation,
    type: definition.type,
    source: definition.source,
    composite: definition.composite || null,
    enabledByDefault: Boolean(definition.enabledByDefault)
  }));
}

function sanitizeRulesetSelections(nextSelections = {}) {
  return Object.keys(DEFAULT_RULESET_SELECTIONS).reduce((acc, key) => {
    acc[key] = typeof nextSelections[key] === 'boolean'
      ? nextSelections[key]
      : DEFAULT_RULESET_SELECTIONS[key];
    return acc;
  }, {});
}

function evaluateCompiledRuleDelta({ definition, playerCount, initialPoints, handCards, nonDiscardedCards }) {
  const result = evaluateRuleWithSnapshot(
    definition.compiled,
    buildRuleSnapshot({
      playerCount,
      initialPoints,
      handCards,
      nonDiscardedCards
    })
  );

  return {
    delta: result.POINTS - initialPoints,
    gameEnded: Boolean(result.gameEnded),
    points: result.POINTS
  };
}

function evaluateCompositeDelta({ definition, playerCount, handCards, nonDiscardedCards }) {
  if (!['totalPlus', 'totalMinus'].includes(definition.composite)) {
    throw new Error(`Unknown composite ruleset '${definition.composite}'`);
  }

  const sign = definition.composite === 'totalPlus' ? 1 : -1;
  const componentDeltas = TOTAL_BASE_RULE_IDS.map((ruleId) => {
    const baseDefinition = RULESETS[ruleId];
    const result = evaluateCompiledRuleDelta({
      definition: baseDefinition,
      playerCount,
      initialPoints: 0,
      handCards,
      nonDiscardedCards
    });

    return {
      ruleId,
      delta: sign * Math.abs(result.delta)
    };
  });

  return {
    delta: componentDeltas.reduce((total, entry) => total + entry.delta, 0),
    gameEnded: false,
    componentDeltas
  };
}

function evaluateRulesetForTrick({ rulesetId, playerCount, initialPoints, handCards, nonDiscardedCards }) {
  const definition = RULESETS[rulesetId];
  if (!definition) {
    throw new Error(`Unknown ruleset '${rulesetId}'`);
  }

  if (definition.composite) {
    const compositeResult = evaluateCompositeDelta({
      definition,
      playerCount,
      handCards,
      nonDiscardedCards
    });

    return {
      ...compositeResult,
      ruleset: definition
    };
  }

  const result = evaluateCompiledRuleDelta({
    definition,
    playerCount,
    initialPoints,
    handCards,
    nonDiscardedCards
  });

  return {
    ...result,
    ruleset: definition
  };
}

module.exports = {
  DEFAULT_RULESET_SELECTIONS,
  ROOT_RULESETS_PATH,
  RULESETS,
  TOTAL_BASE_RULE_IDS,
  evaluateRulesetForTrick,
  getAvailableRulesets,
  readRootRulesets,
  sanitizeRulesetSelections
};
