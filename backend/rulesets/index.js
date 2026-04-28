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

function normalizeCustomRulesets(customRulesets = []) {
  if (Array.isArray(customRulesets)) {
    return customRulesets.filter((definition) => definition?.id && definition?.compiled);
  }

  if (customRulesets && typeof customRulesets === 'object') {
    return Object.values(customRulesets).filter((definition) => definition?.id && definition?.compiled);
  }

  return [];
}

function buildRulesetPreviewCode(definition) {
  if (definition.code) {
    return definition.code;
  }

  if (definition.composite === 'totalPlus') {
    return [
      '# Composite ruleset preview',
      '# Total Plus adds the absolute values of the five classic Rentz base rulesets.',
      '# This built-in preview is informational and does not round-trip through the compiler.'
    ].join('\n');
  }

  if (definition.composite === 'totalMinus') {
    return [
      '# Composite ruleset preview',
      '# Total Minus subtracts the absolute values of the five classic Rentz base rulesets.',
      '# This built-in preview is informational and does not round-trip through the compiler.'
    ].join('\n');
  }

  return '';
}

function serializeRulesetDefinition(definition) {
  return {
    id: definition.id,
    label: definition.label,
    abbreviation: definition.abbreviation,
    type: definition.type,
    source: definition.source,
    code: buildRulesetPreviewCode(definition),
    composite: definition.composite || null,
    enabledByDefault: Boolean(definition.enabledByDefault)
  };
}

function getRulesetDefinitions(customRulesets = []) {
  return [
    ...Object.values(RULESETS),
    ...normalizeCustomRulesets(customRulesets)
  ];
}

function getAvailableRulesets(customRulesets = []) {
  return getRulesetDefinitions(customRulesets).map(serializeRulesetDefinition);
}

function getRulesetDefinitionById(rulesetId, customRulesets = []) {
  return RULESETS[rulesetId] || normalizeCustomRulesets(customRulesets).find((definition) => definition.id === rulesetId) || null;
}

function getRulesetSelectionDefaults(customRulesets = []) {
  return Object.fromEntries(
    getRulesetDefinitions(customRulesets).map((definition) => [
      definition.id,
      definition.enabledByDefault !== false
    ])
  );
}

function sanitizeRulesetSelections(nextSelections = {}, customRulesets = []) {
  const defaults = getRulesetSelectionDefaults(customRulesets);

  return Object.keys(defaults).reduce((acc, key) => {
    acc[key] = typeof nextSelections[key] === 'boolean'
      ? nextSelections[key]
      : defaults[key];
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

  const resolvedPoints = definition.type === 'end_game'
    ? result.TOTAL_POINTS
    : result.POINTS;

  return {
    delta: resolvedPoints - initialPoints,
    gameEnded: Boolean(result.gameEnded),
    points: resolvedPoints
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

function evaluateRulesetForTrick({ rulesetId, playerCount, initialPoints, handCards, nonDiscardedCards, customRulesets = [] }) {
  const definition = getRulesetDefinitionById(rulesetId, customRulesets);
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
  getRulesetDefinitionById,
  getRulesetDefinitions,
  getRulesetSelectionDefaults,
  readRootRulesets,
  sanitizeRulesetSelections
};
