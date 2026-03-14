const { TokenType } = require('./lexer');

class Parser {
  constructor(tokens) {
    this.tokens = tokens;
    this.pos = 0;
  }

  peek(offset = 0) {
    return this.tokens[this.pos + offset];
  }

  consume() {
    return this.tokens[this.pos++];
  }

  match(type, value = null) {
    const token = this.peek();

    if (!token || token.type !== type) {
      return null;
    }

    if (value !== null && token.value !== value) {
      return null;
    }

    this.pos += 1;
    return token;
  }

  expect(type, value = null) {
    const token = this.match(type, value);

    if (!token) {
      const actual = this.peek();
      const received = actual ? `${actual.type}(${actual.value})` : 'EOF';
      throw new Error(`Expected ${type}${value ? ` '${value}'` : ''}, got ${received}`);
    }

    return token;
  }

  skipSeparators() {
    while (this.match(TokenType.NEWLINE) || this.match(TokenType.PUNCTUATION, ';')) {
      continue;
    }
  }

  parse() {
    const body = [];
    this.skipSeparators();

    while (this.peek().type !== TokenType.EOF) {
      body.push(this.parseStatement());
      this.skipSeparators();
    }

    return {
      type: 'Program',
      body
    };
  }

  parseStatement() {
    const token = this.peek();

    if (token.type === TokenType.KEYWORD && token.value === 'if') {
      return this.parseIfStatement();
    }

    const expression = this.parseExpression();
    return {
      type: 'ExpressionStatement',
      expression
    };
  }

  parseIfStatement() {
    const branches = [];

    branches.push(this.parseConditionalBranch('if'));

    while (this.peek().type === TokenType.KEYWORD && this.peek().value === 'elif') {
      branches.push(this.parseConditionalBranch('elif'));
    }

    let elseBody = null;
    if (this.match(TokenType.KEYWORD, 'else')) {
      this.skipSeparators();
      elseBody = this.parseBlockUntil(['endif']);
    }

    this.expect(TokenType.KEYWORD, 'endif');

    return {
      type: 'IfStatement',
      branches,
      elseBody
    };
  }

  parseConditionalBranch(keyword) {
    this.expect(TokenType.KEYWORD, keyword);
    this.expect(TokenType.PUNCTUATION, '(');
    const condition = this.parseExpression();
    this.expect(TokenType.PUNCTUATION, ')');
    this.skipSeparators();

    return {
      type: 'ConditionalBranch',
      condition,
      body: this.parseBlockUntil(['elif', 'else', 'endif'])
    };
  }

  parseBlockUntil(endKeywords) {
    const body = [];
    this.skipSeparators();

    while (
      this.peek().type !== TokenType.EOF &&
      !(this.peek().type === TokenType.KEYWORD && endKeywords.includes(this.peek().value))
    ) {
      body.push(this.parseStatement());
      this.skipSeparators();
    }

    return body;
  }

  parseExpression() {
    return this.parseLogicalOr();
  }

  parseLogicalOr() {
    let expression = this.parseLogicalAnd();

    while (this.match(TokenType.OPERATOR, 'or')) {
      expression = {
        type: 'LogicalExpression',
        operator: 'or',
        left: expression,
        right: this.parseLogicalAnd()
      };
    }

    return expression;
  }

  parseLogicalAnd() {
    let expression = this.parseEquality();

    while (this.match(TokenType.OPERATOR, 'and')) {
      expression = {
        type: 'LogicalExpression',
        operator: 'and',
        left: expression,
        right: this.parseEquality()
      };
    }

    return expression;
  }

  parseEquality() {
    let expression = this.parseRelational();
    let operator;

    while ((operator = this.match(TokenType.OPERATOR, '==') || this.match(TokenType.OPERATOR, '!='))) {
      expression = {
        type: 'BinaryExpression',
        operator: operator.value,
        left: expression,
        right: this.parseRelational()
      };
    }

    return expression;
  }

  parseRelational() {
    let expression = this.parseAdditive();
    let operator;

    while (
      (operator =
        this.match(TokenType.OPERATOR, '<') ||
        this.match(TokenType.OPERATOR, '<=') ||
        this.match(TokenType.OPERATOR, '>') ||
        this.match(TokenType.OPERATOR, '>='))
    ) {
      expression = {
        type: 'BinaryExpression',
        operator: operator.value,
        left: expression,
        right: this.parseAdditive()
      };
    }

    return expression;
  }

  parseAdditive() {
    let expression = this.parseMultiplicative();
    let operator;

    while ((operator = this.match(TokenType.OPERATOR, '+') || this.match(TokenType.OPERATOR, '-'))) {
      expression = {
        type: 'BinaryExpression',
        operator: operator.value,
        left: expression,
        right: this.parseMultiplicative()
      };
    }

    return expression;
  }

  parseMultiplicative() {
    let expression = this.parseUnary();
    let operator;

    while ((operator = this.match(TokenType.OPERATOR, '*') || this.match(TokenType.OPERATOR, '/'))) {
      expression = {
        type: 'BinaryExpression',
        operator: operator.value,
        left: expression,
        right: this.parseUnary()
      };
    }

    return expression;
  }

  parseUnary() {
    const operator = this.match(TokenType.OPERATOR, 'not') || this.match(TokenType.OPERATOR, '-');

    if (operator) {
      return {
        type: 'UnaryExpression',
        operator: operator.value,
        argument: this.parseUnary()
      };
    }

    return this.parsePrimary();
  }

  parsePrimary() {
    const token = this.consume();

    if (!token) {
      throw new Error('Unexpected end of input');
    }

    if (token.type === TokenType.NUMBER) {
      return {
        type: 'Literal',
        value: token.value
      };
    }

    if (token.type === TokenType.IDENTIFIER) {
      if (this.match(TokenType.PUNCTUATION, '(')) {
        const args = [];

        if (!this.match(TokenType.PUNCTUATION, ')')) {
          do {
            args.push(this.parseExpression());
          } while (this.match(TokenType.PUNCTUATION, ','));

          this.expect(TokenType.PUNCTUATION, ')');
        }

        return {
          type: 'CallExpression',
          callee: token.value,
          arguments: args
        };
      }

      return {
        type: 'Identifier',
        name: token.value
      };
    }

    if (token.type === TokenType.PUNCTUATION && token.value === '(') {
      const expression = this.parseExpression();
      this.expect(TokenType.PUNCTUATION, ')');
      return expression;
    }

    throw new Error(`Unexpected token ${token.type}(${token.value}) at ${token.line}:${token.column}`);
  }
}

module.exports = {
  Parser
};
