// Parser for Custom Rentz Rules Engine
const { TokenType } = require('./lexer');

class Parser {
  constructor(tokens) {
    this.tokens = tokens;
    this.pos = 0;
  }

  peek() {
    return this.tokens[this.pos];
  }

  consume() {
    return this.tokens[this.pos++];
  }

  match(type, value = null) {
    const token = this.peek();
    if (!token) return false;
    if (token.type === type && (value === null || token.value === value)) {
      return this.consume();
    }
    return null;
  }

  expect(type, value = null) {
    const token = this.match(type, value);
    if (!token) {
      const peeked = this.peek() ? `${this.peek().type}(${this.peek().value})` : 'EOF';
      throw new Error(`Expected ${type}${value ? " '" + value + "'" : ''}, got ${peeked}`);
    }
    return token;
  }

  parse() {
    const statements = [];
    while (this.peek().type !== TokenType.EOF) {
      statements.push(this.parseStatement());
    }
    return { type: 'Program', body: statements };
  }

  parseStatement() {
    const token = this.peek();

    if (token.type === TokenType.KEYWORD && token.value === 'if') {
      return this.parseIfStatement();
    }

    // It must be an expression (usually a function call like add, set_to)
    const expr = this.parseExpression();
    // Optional semicolon
    this.match(TokenType.PUNCTUATION, ';');
    return { type: 'ExpressionStatement', expression: expr };
  }

  parseIfStatement() {
    this.expect(TokenType.KEYWORD, 'if');
    this.expect(TokenType.PUNCTUATION, '(');
    const condition = this.parseExpression();
    this.expect(TokenType.PUNCTUATION, ')');

    const consequent = [];
    while (this.peek().type !== TokenType.EOF && !['elif', 'else', 'endif'].includes(this.peek().value)) {
      consequent.push(this.parseStatement());
    }

    const alternate = [];
    while (this.peek().type === TokenType.KEYWORD && this.peek().value === 'elif') {
      this.expect(TokenType.KEYWORD, 'elif');
      this.expect(TokenType.PUNCTUATION, '(');
      const elifCondition = this.parseExpression();
      this.expect(TokenType.PUNCTUATION, ')');
      
      const elifBody = [];
      while (this.peek().type !== TokenType.EOF && !['elif', 'else', 'endif'].includes(this.peek().value)) {
        elifBody.push(this.parseStatement());
      }
      alternate.push({ type: 'IfStatement', condition: elifCondition, consequent: elifBody, alternate: [] });
    }

    if (this.match(TokenType.KEYWORD, 'else')) {
      while (this.peek().type !== TokenType.EOF && this.peek().value !== 'endif') {
        const lastAlt = alternate.length > 0 ? alternate[alternate.length - 1].alternate : alternate;
        lastAlt.push(this.parseStatement());
      }
    }

    this.expect(TokenType.KEYWORD, 'endif');

    return { type: 'IfStatement', condition, consequent, alternate };
  }

  parseExpression() {
    return this.parseLogicalOr();
  }

  parseLogicalOr() {
    let left = this.parseLogicalAnd();
    while (this.match(TokenType.OPERATOR, 'or')) {
      const right = this.parseLogicalAnd();
      left = { type: 'LogicalExpression', operator: 'or', left, right };
    }
    return left;
  }

  parseLogicalAnd() {
    let left = this.parseEquality();
    while (this.match(TokenType.OPERATOR, 'and')) {
      const right = this.parseEquality();
      left = { type: 'LogicalExpression', operator: 'and', left, right };
    }
    return left;
  }

  parseEquality() {
    let left = this.parseRelational();
    let opToken;
    while ((opToken = this.match(TokenType.OPERATOR, '==') || this.match(TokenType.OPERATOR, '!='))) {
      const right = this.parseRelational();
      left = { type: 'BinaryExpression', operator: opToken.value, left, right };
    }
    return left;
  }

  parseRelational() {
    let left = this.parseAdditive();
    let opToken;
    while ((opToken = 
      this.match(TokenType.OPERATOR, '<') || 
      this.match(TokenType.OPERATOR, '<=') || 
      this.match(TokenType.OPERATOR, '>') || 
      this.match(TokenType.OPERATOR, '>='))) {
      const right = this.parseAdditive();
      left = { type: 'BinaryExpression', operator: opToken.value, left, right };
    }
    return left;
  }

  parseAdditive() {
    let left = this.parseMultiplicative();
    let opToken;
    while ((opToken = this.match(TokenType.OPERATOR, '+') || this.match(TokenType.OPERATOR, '-'))) {
      const right = this.parseMultiplicative();
      left = { type: 'BinaryExpression', operator: opToken.value, left, right };
    }
    return left;
  }

  parseMultiplicative() {
    let left = this.parseUnary();
    let opToken;
    while ((opToken = this.match(TokenType.OPERATOR, '*') || this.match(TokenType.OPERATOR, '/'))) {
      const right = this.parseUnary();
      left = { type: 'BinaryExpression', operator: opToken.value, left, right };
    }
    return left;
  }

  parseUnary() {
    const opToken = this.match(TokenType.OPERATOR, 'not') || this.match(TokenType.OPERATOR, '-');
    if (opToken) {
      const argument = this.parseUnary();
      return { type: 'UnaryExpression', operator: opToken.value, argument };
    }
    return this.parsePrimary();
  }

  parsePrimary() {
    const token = this.consume();
    
    if (token.type === TokenType.NUMBER) {
      return { type: 'Literal', value: token.value };
    }
    if (token.type === TokenType.STRING) {
      return { type: 'Literal', value: token.value };
    }
    if (token.type === TokenType.IDENTIFIER) {
      // Function call check
      if (this.match(TokenType.PUNCTUATION, '(')) {
        const args = [];
        if (!this.peek() || this.peek().value !== ')') {
          do {
            args.push(this.parseExpression());
          } while (this.match(TokenType.PUNCTUATION, ','));
        }
        this.expect(TokenType.PUNCTUATION, ')');
        return { type: 'CallExpression', callee: token.value, arguments: args };
      }
      // Variable
      return { type: 'Identifier', name: token.value };
    }
    if (token.type === TokenType.PUNCTUATION && token.value === '(') {
      const expr = this.parseExpression();
      this.expect(TokenType.PUNCTUATION, ')');
      return expr;
    }
    
    throw new Error(`Unexpected token at ${token.line}:${token.column}: ${token.value}`);
  }
}

module.exports = { Parser };
