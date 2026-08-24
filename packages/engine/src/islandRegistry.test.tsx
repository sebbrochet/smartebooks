import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { createIslandRegistry, type IslandDefinition } from './islandRegistry';
import { BookProvider } from './reader/BookContext';
import { renderMarkdown } from './markdown/render';
import { extractDirectiveCode } from './markdown/extract';
import type { IslandComponentProps } from './types';

function BoardStub({ data }: IslandComponentProps) {
  const parsed = data as { pgn?: string };
  return <div className="board-stub">{parsed?.pgn}</div>;
}

const demo = (name: string): IslandDefinition => ({ name, component: () => <b>{name}</b> });

describe('createIslandRegistry', () => {
  it('scopes lookups to the provided definitions', () => {
    const registry = createIslandRegistry([demo('quiz'), demo('chessboard')]);
    expect(registry.get('quiz')?.name).toBe('quiz');
    expect(registry.get('video')).toBeUndefined();
    expect(registry.names().sort()).toEqual(['chessboard', 'quiz']);
  });

  it('keeps two books isolated from each other', () => {
    const bookA = createIslandRegistry([demo('only-a')]);
    const bookB = createIslandRegistry([demo('only-b')]);
    expect(bookA.get('only-b')).toBeUndefined();
    expect(bookB.get('only-a')).toBeUndefined();
  });
});

describe('island plugin API', () => {
  const registry = createIslandRegistry([
    {
      name: 'demoboard',
      component: BoardStub,
      extract: (node) => ({ pgn: extractDirectiveCode(node) }),
    },
  ]);

  it('passes a custom island its extracted body data', () => {
    const html = renderToStaticMarkup(
      <BookProvider slug="t" registry={registry}>
        {renderMarkdown(':::demoboard{id="d"}\n```pgn\n1. e4 e5\n```\n:::\n', { registry })}
      </BookProvider>,
    );
    expect(html).toContain('1. e4 e5');
  });

  it('renders an unknown placeholder for directives the book does not declare', () => {
    const html = renderToStaticMarkup(
      <BookProvider slug="t" registry={registry}>
        {renderMarkdown('::notdeclared{id="x"}\n', { registry })}
      </BookProvider>,
    );
    expect(html).toMatch(/unknown interactive block/i);
  });
});
