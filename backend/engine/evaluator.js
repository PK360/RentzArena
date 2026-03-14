// Evaluator for Custom Rentz Rules Engine

class Evaluator {
  constructor(ast, snapshot) {
    this.ast = ast;
    // Snapshot expected to contain: PLAYER_COUNT, INITIAL_POINTS, CARD_NR, SPADES_NR, etc.
    this.snapshot = snapshot || {};
    this.state = {
      POINTS: this.snapshot.INITIAL_POINTS !== undefined ? this.snapshot.INITIAL_POINTS : 0,
      TOTAL_POINTS: 0
    };
    this.stopped = false;
    this.gameEnded = false;
  }

  evaluate() {
    for (const stmt of this.ast.body) {
      if (this.stopped || this.gameEnded) break;
      this.executeStatement(stmt);
    }
    return {
      POINTS: this.state.POINTS,
      TOTAL_POINTS: this.state.TOTAL_POINTS,
      gameEnded: this.gameEnded
    };
  }

  executeStatement(stmt) {
    if (stmt.type === 'ExpressionStatement') {
      this.evaluateExpression(stmt.expression);
    } else if (stmt.type === 'IfStatement') {
      let executed = false;
      const cond = this.evaluateExpression(stmt.condition);
      if (cond) {
        executed = true;
        for (const s of stmt.consequent) {
          if (this.stopped || this.gameEnded) break;
          this.executeStatement(s);
        }
      } else {
        // Evaluate elifs
        for (const elif of stmt.alternate) {
          if (elif.type === 'IfStatement') {
            if (this.evaluateExpression(elif.condition)) {
              executed = true;
              for (const s of elif.consequent) {
                if (this.stopped || this.gameEnded) break;
                this.executeStatement(s);
              }
              break;
            }
          } else {
            // It's an else block statement
            if (!executed) {
              if (this.stopped || this.gameEnded) break;
              this.executeStatement(elif);
            }
          }
        }
      }
    }
  }

  evaluateExpression(expr) {
    switch (expr.type) {
      case 'Literal':
        return expr.value;
      case 'Identifier':
        if (expr.name in this.state) return this.state[expr.name];
        if (expr.name in this.snapshot) return this.snapshot[expr.name];
        // If undefined variable, default to 0 to prevent crashes in math
        return 0;
      case 'UnaryExpression': {
        const arg = this.evaluateExpression(expr.argument);
        if (expr.operator === 'not') return !arg;
        if (expr.operator === '-') return -arg;
        throw new Error(`Unknown unary operator ${expr.operator}`);
      }
      case 'BinaryExpression':
      case 'LogicalExpression': {
        const left = this.evaluateExpression(expr.left);
        const right = expr.operator !== 'and' && expr.operator !== 'or' ? this.evaluateExpression(expr.right) : null;
        
        switch (expr.operator) {
          case '+': return left + right;
          case '-': return left - right;
          case '*': return left * right;
          case '/': return right !== 0 ? left / right : 0;
          case '<': return left < right;
          case '<=': return left <= right;
          case '>': return left > right;
          case '>=': return left >= right;
          case '==': return left === right;
          case '!=': return left !== right;
          case 'and': return left && this.evaluateExpression(expr.right);
          case 'or': return left || this.evaluateExpression(expr.right);
          default: throw new Error(`Unknown operator ${expr.operator}`);
        }
      }
      case 'CallExpression': {
        return this.executeCall(expr.callee, expr.arguments);
      }
      default:
        throw new Error(`Unknown expression type ${expr.type}`);
    }
  }

  executeCall(callee, args) {
    const evalArgs = args.map(a => this.evaluateExpression(a));
    
    // add(expr, condition)
    if (callee === 'add') {
      const condition = evalArgs.length > 1 ? evalArgs[1] : true;
      if (condition) {
        this.state.POINTS += evalArgs[0];
      }
      return;
    }
    
    // set_to(expr, condition)
    if (callee === 'set_to') {
      const condition = evalArgs.length > 1 ? evalArgs[1] : true;
      if (condition) {
        this.state.POINTS = evalArgs[0];
      }
      return;
    }

    // reset_to(expr, condition)
    if (callee === 'reset_to') {
      const condition = evalArgs.length > 1 ? evalArgs[1] : true;
      if (condition) {
        this.state.TOTAL_POINTS = evalArgs[0]; // Sets big-game output
      }
      return;
    }

    // end(condition)
    if (callee === 'end') {
      const condition = evalArgs.length > 0 ? evalArgs[0] : true;
      if (condition) {
        this.stopped = true;
      }
      return;
    }

    // game_end(condition)
    if (callee === 'game_end') {
      const condition = evalArgs.length > 0 ? evalArgs[0] : true;
      if (condition) {
        this.gameEnded = true;
        this.stopped = true;
      }
      return;
    }

    throw new Error(`Unknown function: ${callee}`);
  }
}

module.exports = { Evaluator };
