// Lexer for Custom Rentz Rules Engine
const TokenType = {
  IDENTIFIER: 'IDENTIFIER',
  NUMBER: 'NUMBER',
  STRING: 'STRING',
  PUNCTUATION: 'PUNCTUATION',
  OPERATOR: 'OPERATOR',
  KEYWORD: 'KEYWORD',
  EOF: 'EOF'
};

const KEYWORDS = new Set(['if', 'elif', 'else', 'endif']);
const OPERATORS = new Set(['+', '-', '*', '/', '<', '>', '<=', '>=', '==', '!=']);
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
    this.input = input;
    this.pos = 0;
    this.line = 1;
    this.column = 1;
  }

  peek() {
    return this.pos < this.input.length ? this.input[this.pos] : null;
  }

  advance() {
    const char = this.peek();
    if (char === '\n') {
      this.line++;
      this.column = 1;
    } else {
      this.column++;
    }
    this.pos++;
    return char;
  }

  skipWhitespace() {
    while (this.peek() && /\s/.test(this.peek())) {
      this.advance();
    }
  }

  readNumber() {
    let str = '';
    while (this.peek() && /[0-9.]/.test(this.peek())) {
      str += this.advance();
    }
    return new Token(TokenType.NUMBER, parseFloat(str), this.line, this.column);
  }

  readIdentifierOrKeyword() {
    let str = '';
    while (this.peek() && /[a-zA-Z0-9_\[\]]/.test(this.peek())) { // Brackets for [SUIT]_[VALUE] parsing natively if we want, or just handle variables.
      str += this.advance();
    }
    
    if (KEYWORDS.has(str)) {
      return new Token(TokenType.KEYWORD, str, this.line, this.column);
    }
    if (str === 'not' || str === 'and' || str === 'or') {
      return new Token(TokenType.OPERATOR, str, this.line, this.column);
    }
    return new Token(TokenType.IDENTIFIER, str, this.line, this.column);
  }

  readString() {
    let str = '';
    const quote = this.advance(); // consume opening quote
    while (this.peek() && this.peek() !== quote) {
      str += this.advance();
    }
    this.advance(); // consume closing quote
    return new Token(TokenType.STRING, str, this.line, this.column);
  }

  readOperator() {
    let op = this.advance();
    if (this.peek() && OPERATORS.has(op + this.peek())) {
      op += this.advance();
    }
    return new Token(TokenType.OPERATOR, op, this.line, this.column);
  }

  nextToken() {
    this.skipWhitespace();
    const char = this.peek();

    if (!char) {
      return new Token(TokenType.EOF, null, this.line, this.column);
    }

    if (/[0-9]/.test(char)) return this.readNumber();
    if (/[a-zA-Z_\[]/.test(char)) return this.readIdentifierOrKeyword(); // Starts with letter, underscore or bracket
    if (char === '"' || char === "'") return this.readString();
    
    if (PUNCTUATION.has(char)) {
      this.advance();
      return new Token(TokenType.PUNCTUATION, char, this.line, this.column - 1);
    }

    if (OPERATORS.has(char) || char === '=' || char === '!') {
      return this.readOperator();
    }

    throw new Error(`Unknown character: ${char} at line ${this.line}:${this.column}`);
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

module.exports = { Lexer, TokenType };
