import { SExprNode } from './types';

export class SExpressionParser {
  private input: string;
  private index: number = 0;

  constructor(input: string) {
    this.input = input;
  }

  parse(): SExprNode {
    this.skipWhitespace();
    return this.parseNode();
  }

  private parseNode(): SExprNode {
    this.skipWhitespace();

    if (this.index >= this.input.length) {
      throw new Error('screwed up input');
    }

    if (this.input[this.index] === '(') {
      return this.parseList();
    }
    return this.parseAtom();
  }

  private parseList(): SExprNode {
    if (this.input[this.index] !== '(') {
      throw new Error(`Expected '(', got '${this.input[this.index]}'`);
    }

    this.index++;
    const children: SExprNode[] = [];

    this.skipWhitespace();

    while (this.index < this.input.length && this.input[this.index] !== ')') {
      children.push(this.parseNode());
      this.skipWhitespace();
    }

    if (this.index >= this.input.length || this.input[this.index] !== ')') {
      throw new Error('Unclosed list');
    }

    this.index++;
    return { type: 'list', children };
  }

  private parseAtom(): SExprNode {
    this.skipWhitespace();

    if (this.index >= this.input.length) {
      throw new Error('screwed up input');
    }

    if (this.input[this.index] === '"') {
      return this.parseString();
    }

    const start = this.index;
    while (
      this.index < this.input.length &&
      this.input[this.index] !== ' ' &&
      this.input[this.index] !== '\t' &&
      this.input[this.index] !== '\n' &&
      this.input[this.index] !== '\r' &&
      this.input[this.index] !== '(' &&
      this.input[this.index] !== ')'
    ) {
      this.index++;
    }

    const value = this.input.substring(start, this.index);

    const numValue = parseFloat(value);
    if (!isNaN(numValue) && isFinite(numValue)) {
      return { type: 'atom', value: numValue };
    }

    return { type: 'atom', value };
  }

  private parseString(): SExprNode {
    if (this.input[this.index] !== '"') {
      throw new Error('expected string quote');
    }

    this.index++;
    let value = '';
    let escaped = false;

    while (this.index < this.input.length) {
      const char = this.input[this.index];

      if (escaped) {
        value += char;
        escaped = false;
      } else if (char === '\\') {
        escaped = true;
      } else if (char === '"') {
        this.index++;
        return { type: 'atom', value };
      } else {
        value += char;
      }

      this.index++;
    }

    throw new Error('Unclosed string');
  }

  private skipWhitespace(): void {
    while (
      this.index < this.input.length &&
      (this.input[this.index] === ' ' ||
        this.input[this.index] === '\t' ||
        this.input[this.index] === '\n' ||
        this.input[this.index] === '\r')
    ) {
      this.index++;
    }
  }

  static getFirstValue(node: SExprNode): string | number | undefined {
    if (node.type === 'list' && node.children && node.children.length > 0) {
      const first = node.children[0];
      if (first.type === 'atom') {
        return first.value;
      }
    }
    return undefined;
  }

  static findChildValue(node: SExprNode, childName: string): string | undefined {
    if (node.type !== 'list' || !node.children) {
      return undefined;
    }

    for (const child of node.children) {
      if (
        child.type === 'list' &&
        child.children &&
        child.children.length >= 2 &&
        child.children[0].type === 'atom' &&
        child.children[0].value === childName &&
        child.children[1].type === 'atom'
      ) {
        return String(child.children[1].value);
      }
    }

    return undefined;
  }

  static findProperty(node: SExprNode, propertyName: string): string | undefined {
    if (node.type !== 'list' || !node.children) {
      return undefined;
    }

    for (let i = 0; i < node.children.length; i++) {
      const child = node.children[i];
      if (
        child.type === 'list' &&
        child.children &&
        child.children.length >= 2 &&
        child.children[0].type === 'atom' &&
        child.children[0].value === 'property' &&
        child.children[1].type === 'atom' &&
        child.children[1].value === propertyName
      ) {
        if (child.children.length >= 3 && child.children[2].type === 'atom') {
          return String(child.children[2].value);
        }
      }
    }

    return undefined;
  }

  static extractPosition(node: SExprNode): { x: number; y: number } | undefined {
    if (node.type !== 'list' || !node.children) {
      return undefined;
    }

    for (const child of node.children) {
      if (
        child.type === 'list' &&
        child.children &&
        child.children.length >= 1 &&
        child.children[0].type === 'atom' &&
        child.children[0].value === 'at'
      ) {
        if (child.children.length >= 3) {
          const x = child.children[1].type === 'atom' ? Number(child.children[1].value) : undefined;
          const y = child.children[2].type === 'atom' ? Number(child.children[2].value) : undefined;
          if (x !== undefined && y !== undefined && !isNaN(x) && !isNaN(y)) {
            return { x, y };
          }
        }
      }
    }

    return undefined;
  }
}
