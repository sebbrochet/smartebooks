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

/*
 * A book written on Windows is the common case, not the edge case, and every
 * test above joins with '\n' — so the branches that handle an *opening* `<!--`
 * and a fence marker were unreachable from this file. Both broke on CRLF and
 * neither was noticed: `.` does not match `\r`, and `$` without the `m` flag
 * anchors at the end of the string rather than the line (TASK014).
 */
describe('stripComments, on CRLF', () => {
  const crlf = (lines: string[]) => lines.join('\r\n');

  it('removes a comment on its own line', () => {
    expect(stripComments(crlf(['Before.', '<!-- a note -->', 'After.']))).toBe(
      crlf(['Before.', '', 'After.']),
    );
  });

  // The reported defect: the opening line matched nothing, so comment mode was
  // never entered and the whole comment was copied into the package.
  it('removes a comment spanning several lines', () => {
    const source = crlf(['Before.', '<!-- a note', '   continued -->', 'After.']);
    expect(stripComments(source)).toBe(crlf(['Before.', '', '', 'After.']));
  });

  /*
   * The worse half, and the one no report mentioned: with the fence undetected,
   * this comment was deleted. That is content loss, not a leak.
   */
  it('keeps a comment inside a fenced block', () => {
    const source = crlf(['Text.', '```html', '<!-- the subject -->', '```', 'End.']);
    expect(stripComments(source)).toBe(source);
  });

  it('keeps a comment inside an inline code span', () => {
    const source = crlf(['Use `<!-- more -->` to split.', 'Done.']);
    expect(stripComments(source)).toBe(source);
  });

  // A blanked line must keep its own terminator, or the package gets a file
  // with mixed endings that the author never wrote. Three lines, not two: a
  // two-line comment never reaches the branch that swallows a whole line.
  it('leaves no lone line feed behind', () => {
    const source = crlf(['Before.', '<!-- a note', '   that runs on', '   and ends -->', 'After.']);
    expect(stripComments(source)).not.toMatch(/(?<!\r)\n/);
  });

  it('removes a comment spanning more than two lines', () => {
    const source = crlf(['Before.', '<!-- a note', '   that runs on', '   and ends -->', 'After.']);
    expect(stripComments(source)).toBe(crlf(['Before.', '', '', '', 'After.']));
  });

  it('keeps every line where it was', () => {
    const source = crlf(['# Title', '', '<!-- REQ: a', '     AND b -->', '', 'Line six.']);
    expect(stripComments(source).split('\r\n')).toHaveLength(6);
  });
});
