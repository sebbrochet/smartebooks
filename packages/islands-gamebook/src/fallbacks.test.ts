import { describe, it, expect } from 'vitest';
import { toString } from 'mdast-util-to-string';
import type { RootContent } from 'mdast';
import { gamebookIslands } from './index';

/**
 * The static form of a choice, which §5.1 calls the strongest in the catalogue:
 * `turn to 45` is not a degradation of the printed gamebook, it is the printed
 * gamebook.
 *
 * A fallback **replaces** the directive's children, so an island that ignores
 * its label deletes the author's sentence from the static form. That did not
 * show while the clause lived in the prose beside the directive, and it is the
 * whole cost of moving the clause into the label.
 */
const island = (name: string) => {
  const found = gamebookIslands().find((i) => i.name === name);
  if (!found) throw new Error(`no island named ${name}`);
  return found;
};

const node = (label?: string) =>
  ({
    type: 'textDirective',
    name: 'choice',
    children: label ? [{ type: 'text', value: label }] : [],
  }) as never;

const run = (label: string | undefined, to: string): RootContent[] | undefined =>
  island('choice').fallback?.(node(label), undefined, { attributes: { to } });

const text = (nodes: RootContent[] | undefined) => (nodes ?? []).map((n) => toString(n)).join('');

describe('the printed form of a choice', () => {
  it('is the printed book’s own line', () => {
    expect(text(run(undefined, '45'))).toBe('turn to 45');
  });

  it('keeps the sentence the author wrote', () => {
    expect(text(run('If you open the door', '45'))).toBe('If you open the door — turn to 45');
  });

  it('is nothing at all without a destination', () => {
    expect(run('If you open the door', '')).toBeUndefined();
  });
});
