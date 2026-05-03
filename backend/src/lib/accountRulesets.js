const { getAvailableRulesets, getRulesetDefinitionById } = require('../../rulesets');

const ACCOUNT_RULESET_OPTIONS = Object.freeze(
  getAvailableRulesets().map((definition, index) => Object.freeze({
    index,
    id: definition.id,
    label: definition.label,
    abbreviation: definition.abbreviation
  }))
);

const MAX_FAVOURITE_RULESETS = 5;
const MAX_RULESET_LOADOUT = 3;

function isValidRulesetIndex(index) {
  return Number.isInteger(index) && index >= 0 && index < ACCOUNT_RULESET_OPTIONS.length;
}

function normalizeRulesetIndexes(value, { maxItems, fieldName }) {
  if (value == null) {
    return [];
  }

  if (!Array.isArray(value)) {
    throw new Error(`${fieldName} must be an array of ruleset indexes`);
  }

  const normalizedIndexes = value.map((entry) => Number(entry));

  if (normalizedIndexes.some((entry) => !Number.isInteger(entry))) {
    throw new Error(`${fieldName} must only contain whole-number ruleset indexes`);
  }

  const uniqueIndexes = [...new Set(normalizedIndexes)];

  if (uniqueIndexes.length > maxItems) {
    throw new Error(`${fieldName} can contain at most ${maxItems} rulesets`);
  }

  if (uniqueIndexes.some((entry) => !isValidRulesetIndex(entry))) {
    throw new Error(`${fieldName} contains an invalid ruleset index`);
  }

  return uniqueIndexes;
}

function getRulesetDefinitionByIndex(index) {
  const option = ACCOUNT_RULESET_OPTIONS[index];
  if (!option) {
    return null;
  }

  return getRulesetDefinitionById(option.id);
}

function createSelectedRulesetsFromLoadout(loadoutIndexes = []) {
  const normalizedLoadout = normalizeRulesetIndexes(loadoutIndexes, {
    maxItems: MAX_RULESET_LOADOUT,
    fieldName: 'rulesetLoadout'
  });

  if (normalizedLoadout.length === 0) {
    return null;
  }

  return ACCOUNT_RULESET_OPTIONS.reduce((acc, option) => {
    acc[option.id] = normalizedLoadout.includes(option.index);
    return acc;
  }, {});
}

module.exports = {
  ACCOUNT_RULESET_OPTIONS,
  MAX_FAVOURITE_RULESETS,
  MAX_RULESET_LOADOUT,
  createSelectedRulesetsFromLoadout,
  getRulesetDefinitionByIndex,
  isValidRulesetIndex,
  normalizeRulesetIndexes
};
