const { Lexer } = require('./lexer');
const { Parser } = require('./parser');

const RULESET_TYPES = new Set(['per_round', 'end_game']);
const SUITS = ['HEART', 'DIAMOND', 'CLUB', 'SPADE'];
const EXPRESSION_TYPES = Object.freeze({
  BOOLEAN: 'boolean',
  NUMBER: 'number',
  VOID: 'void'
});
const VALUE_ALIASES = {
  ACE: 'A',
  KING: 'K',
  QUEEN: 'Q',
  JACK: 'J',
  TEN: '10',
  NINE: '9',
  EIGHT: '8',
  SEVEN: '7',
  SIX: '6',
  FIVE: '5',
  FOUR: '4',
  THREE: '3',
  TWO: '2'
};
const SUIT_ALIASES = {
  H: 'HEART',
  HEART: 'HEART',
  HEARTS: 'HEART',
  D: 'DIAMOND',
  DIAMOND: 'DIAMOND',
  DIAMONDS: 'DIAMOND',
  C: 'CLUB',
  CLUB: 'CLUB',
  CLUBS: 'CLUB',
  S: 'SPADE',
  SPADE: 'SPADE',
  SPADES: 'SPADE'
};
const VALUES = ['A', 'K', 'Q', 'J', '10', '9', '8', '7', '6', '5', '4', '3', '2'];
const NUMERIC_IDENTIFIER_NAMES = new Set(['PLAYER_COUNT', 'INITIAL_POINTS', 'CARD_NR', 'POINTS', 'TOTAL_POINTS']);
const BOOLEAN_IDENTIFIER_NAMES = new Set();

for (const suit of SUITS) {
  NUMERIC_IDENTIFIER_NAMES.add(`${suit}_NR`);
  NUMERIC_IDENTIFIER_NAMES.add(`TOTAL_${suit}_NR`);

  for (const value of VALUES) {
    BOOLEAN_IDENTIFIER_NAMES.add(`${suit}_${value}`);
  }
}

for (const value of VALUES) {
  NUMERIC_IDENTIFIER_NAMES.add(`${value}_NR`);
  NUMERIC_IDENTIFIER_NAMES.add(`TOTAL_${value}_NR`);
}

function getStaticIdentifierType(name) {
  if (NUMERIC_IDENTIFIER_NAMES.has(name)) {
    return EXPRESSION_TYPES.NUMBER;
  }

  if (BOOLEAN_IDENTIFIER_NAMES.has(name)) {
    return EXPRESSION_TYPES.BOOLEAN;
  }

  const aliasName = buildAliasKey(name);
  if (aliasName && NUMERIC_IDENTIFIER_NAMES.has(aliasName)) {
    return EXPRESSION_TYPES.NUMBER;
  }

  if (aliasName && BOOLEAN_IDENTIFIER_NAMES.has(aliasName)) {
    return EXPRESSION_TYPES.BOOLEAN;
  }

  return null;
}

function ensureExpressionType(expression, expectedType, message, rulesetType) {
  const receivedType = inferExpressionType(expression, rulesetType);
  if (receivedType !== expectedType) {
    throw new Error(message);
  }
}

function validateConditionExpression(expression, rulesetType) {
  const type = inferExpressionType(expression, rulesetType);
  if (type !== EXPRESSION_TYPES.BOOLEAN && type !== EXPRESSION_TYPES.NUMBER) {
    throw new Error('Expected a boolean condition');
  }
}

function validateCallArity(name, argCount, min, max) {
  if (argCount < min || argCount > max) {
    throw new Error(`${name} expects between ${min} and ${max} arguments`);
  }
}

function validateCallExpression(expression, rulesetType) {
  const args = expression.arguments || [];

  switch (expression.callee) {
    case 'add':
    case 'set_to':
      validateCallArity(expression.callee, args.length, 1, 2);
      ensureExpressionType(args[0], EXPRESSION_TYPES.NUMBER, `${expression.callee} expects a numeric first argument`, rulesetType);
      if (args.length === 2) {
        validateConditionExpression(args[1], rulesetType);
      }
      return EXPRESSION_TYPES.VOID;
    case 'reset_to':
      if (rulesetType !== 'end_game') {
        throw new Error('reset_to is only allowed in end_game rulesets');
      }
      validateCallArity(expression.callee, args.length, 1, 2);
      ensureExpressionType(args[0], EXPRESSION_TYPES.NUMBER, `${expression.callee} expects a numeric first argument`, rulesetType);
      if (args.length === 2) {
        validateConditionExpression(args[1], rulesetType);
      }
      return EXPRESSION_TYPES.VOID;
    case 'end':
      validateCallArity(expression.callee, args.length, 0, 1);
      if (args.length === 1) {
        validateConditionExpression(args[0], rulesetType);
      }
      return EXPRESSION_TYPES.VOID;
    case 'game_end':
      if (rulesetType !== 'per_round') {
        throw new Error('game_end is only allowed in per_round rulesets');
      }
      validateCallArity(expression.callee, args.length, 0, 1);
      if (args.length === 1) {
        validateConditionExpression(args[0], rulesetType);
      }
      return EXPRESSION_TYPES.VOID;
    default:
      throw new Error(`Unknown function '${expression.callee}'`);
  }
}

function inferExpressionType(expression, rulesetType) {
  switch (expression.type) {
    case 'Literal':
      if (!Number.isFinite(expression.value)) {
        throw new Error('Invalid numeric literal');
      }
      return EXPRESSION_TYPES.NUMBER;
    case 'Identifier': {
      const identifierType = getStaticIdentifierType(expression.name);
      if (!identifierType) {
        throw new Error(`Unknown identifier '${expression.name}'`);
      }
      return identifierType;
    }
    case 'UnaryExpression':
      if (expression.operator === 'not') {
        validateConditionExpression(expression.argument, rulesetType);
        return EXPRESSION_TYPES.BOOLEAN;
      }

      if (expression.operator === '-') {
        ensureExpressionType(expression.argument, EXPRESSION_TYPES.NUMBER, 'Unary - expects a numeric expression', rulesetType);
        return EXPRESSION_TYPES.NUMBER;
      }

      throw new Error(`Unsupported unary operator '${expression.operator}'`);
    case 'LogicalExpression':
      validateConditionExpression(expression.left, rulesetType);
      validateConditionExpression(expression.right, rulesetType);
      return EXPRESSION_TYPES.BOOLEAN;
    case 'BinaryExpression': {
      if (['+', '-', '*', '/'].includes(expression.operator)) {
        ensureExpressionType(expression.left, EXPRESSION_TYPES.NUMBER, `Operator '${expression.operator}' expects numeric operands`, rulesetType);
        ensureExpressionType(expression.right, EXPRESSION_TYPES.NUMBER, `Operator '${expression.operator}' expects numeric operands`, rulesetType);
        return EXPRESSION_TYPES.NUMBER;
      }

      if (['<', '<=', '>', '>='].includes(expression.operator)) {
        ensureExpressionType(expression.left, EXPRESSION_TYPES.NUMBER, `Operator '${expression.operator}' expects numeric operands`, rulesetType);
        ensureExpressionType(expression.right, EXPRESSION_TYPES.NUMBER, `Operator '${expression.operator}' expects numeric operands`, rulesetType);
        return EXPRESSION_TYPES.BOOLEAN;
      }

      if (['==', '!='].includes(expression.operator)) {
        const leftType = inferExpressionType(expression.left, rulesetType);
        const rightType = inferExpressionType(expression.right, rulesetType);

        if (leftType !== rightType) {
          throw new Error(`Operator '${expression.operator}' expects operands of the same type`);
        }

        return EXPRESSION_TYPES.BOOLEAN;
      }

      throw new Error(`Unsupported operator '${expression.operator}'`);
    }
    case 'CallExpression':
      return validateCallExpression(expression, rulesetType);
    default:
      throw new Error(`Unsupported expression type '${expression.type}'`);
  }
}

function validateStatement(statement, rulesetType) {
  if (statement.type === 'ExpressionStatement') {
    if (statement.expression.type !== 'CallExpression') {
      throw new Error('Standalone expressions are not allowed; use a ruleset function call');
    }

    inferExpressionType(statement.expression, rulesetType);
    return;
  }

  if (statement.type === 'IfStatement') {
    for (const branch of statement.branches) {
      validateConditionExpression(branch.condition, rulesetType);
      branch.body.forEach((childStatement) => validateStatement(childStatement, rulesetType));
    }

    if (statement.elseBody) {
      statement.elseBody.forEach((childStatement) => validateStatement(childStatement, rulesetType));
    }
    return;
  }

  throw new Error(`Unsupported statement type '${statement.type}'`);
}

function validateRulesetAst(ast, rulesetType) {
  if (!ast.body.length) {
    throw new Error('Ruleset code is empty');
  }

  for (const statement of ast.body) {
    validateStatement(statement, rulesetType);
  }
}

function compileRuleset(code, type = 'per_round') {
  if (!RULESET_TYPES.has(type)) {
    throw new Error(`Unsupported ruleset type '${type}'`);
  }

  const lexer = new Lexer(code);
  const parser = new Parser(lexer.tokenize());
  const ast = parser.parse();
  validateRulesetAst(ast, type);

  return {
    type: 'Ruleset',
    rulesetType: type,
    body: ast.body
  };
}

function normalizeCard(card) {
  if (!card) {
    throw new Error('Card is required');
  }

  if (typeof card === 'object') {
    const value = String(card.value || '').toUpperCase();
    const suit = SUIT_ALIASES[String(card.suit || '').toUpperCase()];

    if (!value || !suit) {
      throw new Error(`Invalid card object ${JSON.stringify(card)}`);
    }

    return { value, suit };
  }

  const raw = String(card).trim().toUpperCase();

  if (raw.includes('-')) {
    const [valuePart, suitPart] = raw.split('-');
    const suit = SUIT_ALIASES[suitPart];

    if (!VALUES.includes(valuePart) || !suit) {
      throw new Error(`Invalid card '${card}'`);
    }

    return { value: valuePart, suit };
  }

  const suitKey = raw.endsWith('10') ? raw.slice(2) : raw.slice(-1);
  const value = raw.endsWith('10') ? raw.slice(0, 2) : raw.slice(0, -1);
  const suit = SUIT_ALIASES[suitKey];

  if (!VALUES.includes(value) || !suit) {
    throw new Error(`Invalid card '${card}'`);
  }

  return { value, suit };
}

function countCards(cards) {
  const suitCounts = Object.fromEntries(SUITS.map((suit) => [suit, 0]));
  const valueCounts = Object.fromEntries(VALUES.map((value) => [value, 0]));
  const cardPresence = {};

  for (const suit of SUITS) {
    for (const value of VALUES) {
      cardPresence[`${suit}_${value}`] = false;
    }
  }

  for (const rawCard of cards) {
    const { suit, value } = normalizeCard(rawCard);
    suitCounts[suit] += 1;
    valueCounts[value] += 1;
    cardPresence[`${suit}_${value}`] = true;
  }

  return { suitCounts, valueCounts, cardPresence };
}

function buildAliasKey(name) {
  const parts = String(name).split('_');
  const normalized = parts.map((part) => VALUE_ALIASES[part] || part);
  const alias = normalized.join('_');
  return alias === name ? null : alias;
}

function buildRuleSnapshot({
  playerCount,
  initialPoints = 0,
  handCards = [],
  nonDiscardedCards = []
}) {
  if (!Number.isInteger(playerCount) || playerCount < 2) {
    throw new Error('playerCount must be an integer greater than or equal to 2');
  }

  const handCountData = countCards(handCards);
  const totalCountData = countCards(nonDiscardedCards);

  const snapshot = {
    PLAYER_COUNT: playerCount,
    INITIAL_POINTS: initialPoints,
    CARD_NR: handCards.length
  };

  for (const suit of SUITS) {
    snapshot[`${suit}_NR`] = handCountData.suitCounts[suit];
    snapshot[`TOTAL_${suit}_NR`] = totalCountData.suitCounts[suit];
  }

  for (const value of VALUES) {
    snapshot[`${value}_NR`] = handCountData.valueCounts[value];
    snapshot[`TOTAL_${value}_NR`] = totalCountData.valueCounts[value];
  }

  Object.assign(snapshot, handCountData.cardPresence);

  return snapshot;
}

class Evaluator {
  constructor(ast, snapshot) {
    this.ast = ast;
    this.snapshot = snapshot || {};
    this.isEndGameRuleset = ast?.rulesetType === 'end_game';
    this.state = {
      POINTS: this.snapshot.INITIAL_POINTS || 0,
      TOTAL_POINTS: this.isEndGameRuleset ? (this.snapshot.INITIAL_POINTS || 0) : 0
    };
    this.stopped = false;
    this.gameEnded = false;
  }

  evaluate() {
    for (const statement of this.ast.body) {
      if (this.stopped || this.gameEnded) {
        break;
      }

      this.executeStatement(statement);
    }

    return {
      POINTS: this.state.POINTS,
      TOTAL_POINTS: this.state.TOTAL_POINTS,
      gameEnded: this.gameEnded
    };
  }

  executeStatement(statement) {
    if (statement.type === 'ExpressionStatement') {
      this.evaluateExpression(statement.expression);
      return;
    }

    if (statement.type === 'IfStatement') {
      this.executeIfStatement(statement);
      return;
    }

    throw new Error(`Unsupported statement type '${statement.type}'`);
  }

  executeIfStatement(statement) {
    for (const branch of statement.branches) {
      if (this.evaluateExpression(branch.condition)) {
        this.executeBlock(branch.body);
        return;
      }
    }

    if (statement.elseBody) {
      this.executeBlock(statement.elseBody);
    }
  }

  executeBlock(statements) {
    for (const statement of statements) {
      if (this.stopped || this.gameEnded) {
        break;
      }

      this.executeStatement(statement);
    }
  }

  evaluateExpression(expression) {
    switch (expression.type) {
      case 'Literal':
        return expression.value;
      case 'Identifier':
        return this.resolveIdentifier(expression.name);
      case 'UnaryExpression':
        return this.evaluateUnaryExpression(expression);
      case 'BinaryExpression':
      case 'LogicalExpression':
        return this.evaluateBinaryExpression(expression);
      case 'CallExpression':
        return this.executeCall(expression);
      default:
        throw new Error(`Unsupported expression type '${expression.type}'`);
    }
  }

  resolveIdentifier(name) {
    if (Object.prototype.hasOwnProperty.call(this.state, name)) {
      return this.state[name];
    }

    if (Object.prototype.hasOwnProperty.call(this.snapshot, name)) {
      return this.snapshot[name];
    }

    const aliasName = buildAliasKey(name);
    if (aliasName && Object.prototype.hasOwnProperty.call(this.snapshot, aliasName)) {
      return this.snapshot[aliasName];
    }

    return false;
  }

  evaluateUnaryExpression(expression) {
    const value = this.evaluateExpression(expression.argument);

    if (expression.operator === 'not') {
      return !value;
    }

    if (expression.operator === '-') {
      return -Number(value || 0);
    }

    throw new Error(`Unsupported unary operator '${expression.operator}'`);
  }

  evaluateBinaryExpression(expression) {
    if (expression.operator === 'and') {
      return this.evaluateExpression(expression.left) && this.evaluateExpression(expression.right);
    }

    if (expression.operator === 'or') {
      return this.evaluateExpression(expression.left) || this.evaluateExpression(expression.right);
    }

    const left = this.evaluateExpression(expression.left);
    const right = this.evaluateExpression(expression.right);

    switch (expression.operator) {
      case '+':
        return Number(left) + Number(right);
      case '-':
        return Number(left) - Number(right);
      case '*':
        return Number(left) * Number(right);
      case '/':
        return Number(right) === 0 ? 0 : Number(left) / Number(right);
      case '<':
        return left < right;
      case '<=':
        return left <= right;
      case '>':
        return left > right;
      case '>=':
        return left >= right;
      case '==':
        return left === right;
      case '!=':
        return left !== right;
      default:
        throw new Error(`Unsupported operator '${expression.operator}'`);
    }
  }

  executeCall(expression) {
    const args = expression.arguments.map((argument) => this.evaluateExpression(argument));

    switch (expression.callee) {
      case 'add':
        this.assertArity(expression.callee, args, 1, 2);
        if (args[1] ?? true) {
          this.state.POINTS += Number(args[0]);
          if (this.isEndGameRuleset) {
            this.state.TOTAL_POINTS += Number(args[0]);
          }
        }
        return null;
      case 'set_to':
        this.assertArity(expression.callee, args, 1, 2);
        if (args[1] ?? true) {
          this.state.POINTS = Number(args[0]);
          if (this.isEndGameRuleset) {
            this.state.TOTAL_POINTS = Number(args[0]);
          }
        }
        return null;
      case 'reset_to':
        this.assertArity(expression.callee, args, 1, 2);
        if (args[1] ?? true) {
          this.state.TOTAL_POINTS = Number(args[0]);
        }
        return null;
      case 'end':
        this.assertArity(expression.callee, args, 0, 1);
        if (args[0] ?? true) {
          this.stopped = true;
        }
        return null;
      case 'game_end':
        this.assertArity(expression.callee, args, 0, 1);
        if (args[0] ?? true) {
          this.stopped = true;
          this.gameEnded = true;
        }
        return null;
      default:
        throw new Error(`Unknown function '${expression.callee}'`);
    }
  }

  assertArity(name, args, min, max) {
    if (args.length < min || args.length > max) {
      throw new Error(`${name} expects between ${min} and ${max} arguments`);
    }
  }
}

function evaluateRuleWithSnapshot(compiledRuleset, snapshot) {
  const evaluator = new Evaluator(compiledRuleset, snapshot);
  return evaluator.evaluate();
}

function evaluateIsolatedHands({ code, type = 'per_round', evaluations }) {
  const compiledRuleset =
    typeof code === 'string' ? compileRuleset(code, type) : code;

  const results = [];
  let gameEnded = false;

  for (const evaluation of evaluations) {
    const snapshot = evaluation.snapshot
      ? evaluation.snapshot
      : buildRuleSnapshot(evaluation);
    const result = evaluateRuleWithSnapshot(compiledRuleset, snapshot);

    results.push(result);

    if (result.gameEnded) {
      gameEnded = true;
      break;
    }
  }

  return {
    rulesetType: compiledRuleset.rulesetType,
    results,
    gameEnded
  };
}

module.exports = {
  VALUES,
  SUITS,
  Evaluator,
  buildRuleSnapshot,
  compileRuleset,
  evaluateRuleWithSnapshot,
  evaluateIsolatedHands,
  normalizeCard
};
