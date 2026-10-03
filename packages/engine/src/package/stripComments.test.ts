import { describe, it, expect } from 'vitest';
import { stripComments } from './stripComments';

describe('stripComments', () => {
  it('removes a comment that occupies its own line', () => {
    expect(stripComments('Avant.\n\n<!-- SET: bouton-trouve -->\n\nAprès.\n')).toBe(
      'Avant.\n\n\n\nAprès.\n',
    );
  });

  it('removes a comment written inside a sentence', () => {
    expect(stripComments('The king <!-- really the double --> speaks.')).toBe('The king  speaks.');
  });

  it('removes a comment spanning several lines', () => {
    const source = ['Before.', '', '<!-- REQ: a', '     AND NOT b -->', '', 'After.'].join('\n');
    expect(stripComments(source)).toBe(['Before.', '', '', '', '', 'After.'].join('\n'));
  });

  /*
   * The reason this cannot reuse `toPlainText`'s regex. A book that documents
   * HTML is showing the reader a comment on purpose.
   */
  it('keeps a comment inside a fenced block', () => {
    const source = ['Write this:', '', '```html', '<!-- a comment -->', '```', '', 'Done.'].join(
      '\n',
    );
    expect(stripComments(source)).toBe(source);
  });

  it('keeps a comment inside an inline code span', () => {
    expect(stripComments('Use `<!-- more -->` to split the post.')).toBe(
      'Use `<!-- more -->` to split the post.',
    );
  });

  it('strips again after a fence closes', () => {
    const source = ['```', 'kept <!-- in -->', '```', '', 'gone <!-- out -->'].join('\n');
    expect(stripComments(source)).toBe(['```', 'kept <!-- in -->', '```', '', 'gone'].join('\n'));
  });

  // A tilde fence may contain backticks, which is why both markers are tracked.
  it('honours a tilde fence', () => {
    const source = ['~~~', '<!-- kept -->', '~~~'].join('\n');
    expect(stripComments(source)).toBe(source);
  });

  // A longer fence closes a shorter one; a shorter one does not close a longer.
  it('does not let a shorter fence close a longer one', () => {
    const source = ['````', '```', '<!-- kept -->', '````', '', '<!-- gone -->'].join('\n');
    expect(stripComments(source)).toBe(['````', '```', '<!-- kept -->', '````', '', ''].join('\n'));
  });

  it('leaves a book with no comments byte-identical', () => {
    const source = '# Title\n\nSome prose, with a colon: here.\n\n:choice{to="2"}.\n';
    expect(stripComments(source)).toBe(source);
  });

  /*
   * A comment becomes blank space rather than a deleted line, which is what
   * lets the packager lint the compiled form and still point a diagnostic at
   * the author's own file.
   */
  it('keeps every line where it was', () => {
    const source = ['# Title', '', '<!-- REQ: a', '     AND b -->', '', 'Line six.'].join('\n');
    const stripped = stripComments(source).split('\n');

    expect(stripped).toHaveLength(6);
    expect(stripped[5]).toBe('Line six.');
  });
});
