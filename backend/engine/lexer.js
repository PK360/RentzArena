const TokenType = {
  IDENTIFIER: 'IDENTIFIER',
  NUMBER: 'NUMBER',
  NEWLINE: 'NEWLINE',
  PUNCTUATION: 'PUNCTUATION',
  OPERATOR: 'OPERATOR',
  KEYWORD: 'KEYWORD',
  EOF: 'EOF'
};

const KEYWORDS = new Set(['if', 'elif', 'else', 'endif']);
const WORD_OPERATORS = new Set(['not', 'and', 'or']);
const SYMBOL_OPERATORS = new Set(['+', '-', '*', '/', '<', '>', '<=', '>=', '==', '!=']);
const PUNCTUATION = new Set(['(', ')', ',', ';']);

class Token {
  constructor(type, value, line, column) {
    this.type = type;
    this.value = value;
    this.line = line;
    this.column = column;
  }
}

class Lexer {
  constructor(input) {
    this.input = input || '';
    this.pos = 0;
    this.line = 1;
    this.column = 1;
  }

  peek(offset = 0) {
    return this.input[this.pos + offset] || null;
  }

  advance() {
    const char = this.peek();

    if (!char) {
      return null;
    }

    this.pos += 1;

    if (char === '\n') {
      this.line += 1;
      this.column = 1;
    } else {
      this.column += 1;
    }

    return char;
  }

  skipInlineWhitespace() {
    while (this.peek() && /[ \t\r]/.test(this.peek())) {
      this.advance();
    }
  }

  skipComment() {
    while (this.peek() && this.peek() !== '\n') {
      this.advance();
    }
  }

  readNumberOrIdentifier() {
    const startLine = this.line;
    const startColumn = this.column;
    let value = '';

    while (this.peek() && /[0-9.]/.test(this.peek())) {
      value += this.advance();
    }

    if (this.peek() && /[A-Za-z_]/.test(this.peek())) {
      while (this.peek() && /[A-Za-z0-9_]/.test(this.peek())) {
        value += this.advance();
      }

      return new Token(TokenType.IDENTIFIER, value, startLine, startColumn);
    }

    return new Token(TokenType.NUMBER, Number(value), startLine, startColumn);
  }

  readIdentifierOrKeyword() {
    const startLine = this.line;
    const startColumn = this.column;
    let value = '';

    while (this.peek() && /[A-Za-z0-9_]/.test(this.peek())) {
      value += this.advance();
    }

    if (KEYWORDS.has(value)) {
      return new Token(TokenType.KEYWORD, value, startLine, startColumn);
    }

    if (WORD_OPERATORS.has(value)) {
      return new Token(TokenType.OPERATOR, value, startLine, startColumn);
    }

    return new Token(TokenType.IDENTIFIER, value, startLine, startColumn);
  }

  readOperator() {
    const startLine = this.line;
    const startColumn = this.column;
    let value = this.advance();

    if (this.peek() && SYMBOL_OPERATORS.has(value + this.peek())) {
      value += this.advance();
    }

    return new Token(TokenType.OPERATOR, value, startLine, startColumn);
  }

  nextToken() {
    while (true) {
      this.skipInlineWhitespace();

      if (this.peek() === '#') {
        this.skipComment();
        continue;
      }

      break;
    }

    const char = this.peek();

    if (!char) {
      return new Token(TokenType.EOF, null, this.line, this.column);
    }

    if (char === '\n') {
      const line = this.line;
      const column = this.column;
      this.advance();
      return new Token(TokenType.NEWLINE, '\n', line, column);
    }

    if (/[0-9]/.test(char)) {
      return this.readNumberOrIdentifier();
    }

    if (/[A-Za-z_]/.test(char)) {
      return this.readIdentifierOrKeyword();
    }

    if (PUNCTUATION.has(char)) {
      const line = this.line;
      const column = this.column;
      this.advance();
      return new Token(TokenType.PUNCTUATION, char, line, column);
    }

    if ('+-*/<>!='.includes(char)) {
      return this.readOperator();
    }

    throw new Error(`Unexpected character '${char}' at ${this.line}:${this.column}`);
  }

  tokenize() {
    const tokens = [];
    let token;

    do {
      token = this.nextToken();
      tokens.push(token);
    } while (token.type !== TokenType.EOF);

    return tokens;
  }
}

module.exports = {
  Lexer,
  TokenType
};
