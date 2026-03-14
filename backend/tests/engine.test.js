const test = require('node:test');
const assert = require('node:assert');
const { Lexer } = require('../engine/lexer');
const { Parser } = require('../engine/parser');
const { Evaluator } = require('../engine/evaluator');

function runRules(code, snapshot) {
  const lexer = new Lexer(code);
  const parser = new Parser(lexer.tokenize());
  const ast = parser.parse();
  const evaluator = new Evaluator(ast, snapshot);
  return evaluator.evaluate();
}

test('Simple add(5, SPADE_NR >= 3)', (t) => {
  const code = 'add(5, SPADE_NR >= 3);';
  
  // Case 1: SPADE_NR is 3 -> Condition true -> POINTS += 5
  let res1 = runRules(code, { INITIAL_POINTS: 10, SPADE_NR: 3 });
  assert.strictEqual(res1.POINTS, 15);

  // Case 2: SPADE_NR is 2 -> Condition false -> POINTS unchanged
  let res2 = runRules(code, { INITIAL_POINTS: 10, SPADE_NR: 2 });
  assert.strictEqual(res2.POINTS, 10);
});

test('if / else blocks and game_end()', (t) => {
  const code = `
    if(HEART_KING)
      add(-100);
      game_end();
    else
      add(10);
    endif
  `;
  
  let res1 = runRules(code, { INITIAL_POINTS: 0, HEART_KING: true });
  assert.strictEqual(res1.POINTS, -100);
  assert.strictEqual(res1.gameEnded, true);
  
  let res2 = runRules(code, { INITIAL_POINTS: 0, HEART_KING: false });
  assert.strictEqual(res2.POINTS, 10);
  assert.strictEqual(res2.gameEnded, false);
});

test('Multiple conditions with elif', (t) => {
  const code = `
    if(CARD_NR == 1)
      add(5);
    elif(CARD_NR == 2 and SPADES_NR > 0)
      add(10);
    else
      set_to(0);
    endif
  `;
  
  let res1 = runRules(code, { INITIAL_POINTS: 20, CARD_NR: 1, SPADES_NR: 0 });
  assert.strictEqual(res1.POINTS, 25);
  
  let res2 = runRules(code, { INITIAL_POINTS: 20, CARD_NR: 2, SPADES_NR: 1 });
  assert.strictEqual(res2.POINTS, 30);
  
  let res3 = runRules(code, { INITIAL_POINTS: 20, CARD_NR: 3 });
  assert.strictEqual(res3.POINTS, 0);
});

test('reset_to changes TOTAL_POINTS', (t) => {
  const code = `
    if(HEART_KING)
      reset_to(1000);
    endif
  `;
  let res = runRules(code, { INITIAL_POINTS: 50, HEART_KING: true });
  assert.strictEqual(res.POINTS, 50, 'reset_to should not modify small-game hand points directly according to new specs, or if it does, it sets total');
  assert.strictEqual(res.TOTAL_POINTS, 1000);
});

test('Math operations with constants and variables', (t) => {
  const code = 'add(-3 * POINTS, CARD_NR >= 2);';
  
  // POINTS starts at INITIAL_POINTS = 10. -3 * 10 = -30. 10 + (-30) = -20.
  let res = runRules(code, { INITIAL_POINTS: 10, CARD_NR: 5 });
  assert.strictEqual(res.POINTS, -20);
});
