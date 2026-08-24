import { describe, expect, it } from 'vitest';
import { computeFormattedSelection, type FormatAction } from './markdownEditor';

const bold: FormatAction = { kind: 'wrap', before: '**', after: '**', placeholder: 'bold text' };
const codeBlock: FormatAction = { kind: 'block', before: '\n```\n', after: '\n```', placeholder: 'code' };
const bullet: FormatAction = { kind: 'prefix', prefix: '- ', placeholder: 'item' };
const quote: FormatAction = { kind: 'prefix', prefix: '> ', placeholder: '' };

describe('computeFormattedSelection — wrap', () => {
  it('wraps the selected range and places the cursor over it', () => {
    const result = computeFormattedSelection('hello world', 6, 11, bold);
    expect(result.newContent).toBe('hello **world**');
    expect(result.cursorStart).toBe(8);
    expect(result.cursorEnd).toBe(13);
  });

  it('inserts the placeholder when nothing is selected', () => {
    const result = computeFormattedSelection('abc', 0, 0, bold);
    expect(result.newContent).toBe('**bold text**abc');
    expect(result.cursorStart).toBe(2);
    expect(result.cursorEnd).toBe(11);
  });

  it('works mid-document without disturbing surrounding text', () => {
    const result = computeFormattedSelection('ab cd ef', 3, 5, bold);
    expect(result.newContent).toBe('ab **cd** ef');
  });
});

describe('computeFormattedSelection — block', () => {
  it('fences the selected content on its own lines', () => {
    const result = computeFormattedSelection('x', 1, 1, codeBlock);
    expect(result.newContent).toBe('x\n```\ncode\n```');
    expect(result.cursorStart).toBe(6);
    expect(result.cursorEnd).toBe(10);
  });
});

describe('computeFormattedSelection — prefix', () => {
  it('prefixes each line of a multi-line selection', () => {
    const result = computeFormattedSelection('a\nb', 0, 3, quote);
    expect(result.newContent).toBe('> a\n> b');
    expect(result.cursorStart).toBe(0);
    expect(result.cursorEnd).toBe(7);
  });

  it('uses the placeholder for an empty selection', () => {
    const result = computeFormattedSelection('', 0, 0, bullet);
    expect(result.newContent).toBe('- item');
    expect(result.cursorStart).toBe(0);
    expect(result.cursorEnd).toBe(6);
  });

  it('prefixes at an offset inside the document', () => {
    const result = computeFormattedSelection('one\ntwo\nthree', 4, 7, bullet);
    expect(result.newContent).toBe('one\n- two\nthree');
  });
});
