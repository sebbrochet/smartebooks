// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react';
import type { Book } from '@smart-ebooks/engine';
import { BookCover } from './BookCover';

/**
 * Every bundled book packages artwork, so nothing on the shelf exercises the
 * generated cover any more. It is still what an imported book without one
 * gets, which is exactly the kind of path that rots unwatched.
 */
function book(meta: Partial<Book['meta']>): Book {
  return {
    meta: { slug: 'a-book', title: 'A Book', authors: [], ...meta },
    chapters: [],
    islands: {},
    assets: {},
  } as unknown as Book;
}

let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
  host = document.createElement('div');
  document.body.append(host);
  act(() => {
    root = createRoot(host);
  });
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

const render = (element: React.ReactElement) => act(() => root.render(element));

describe('BookCover', () => {
  it('draws the artwork a book packages', () => {
    render(<BookCover book={book({ cover: 'assets/cover.svg' })} />);

    const image = host.querySelector('img');
    expect(image).not.toBeNull();
    expect(image?.getAttribute('src')).toBe('assets/cover.svg');
    expect(host.querySelector('.bookcover--generated')).toBeNull();
  });

  it('falls back to a title card when there is none', () => {
    render(<BookCover book={book({ title: 'The Cellar Door', authors: ['Smart Ebooks'] })} />);

    expect(host.querySelector('img')).toBeNull();
    const generated = host.querySelector('.bookcover--generated');
    expect(generated?.textContent).toContain('The Cellar Door');
    expect(generated?.textContent).toContain('Smart Ebooks');
  });

  // Decorative: the accessible name comes from the link and heading around it,
  // so a cover that announced itself would say everything twice.
  it('is hidden from assistive technology either way', () => {
    render(<BookCover book={book({ cover: 'assets/cover.svg' })} />);
    expect(host.querySelector('img')?.getAttribute('aria-hidden')).toBe('true');

    render(<BookCover book={book({})} />);
    expect(host.querySelector('.bookcover--generated')?.getAttribute('aria-hidden')).toBe('true');
  });

  it('gives the same book the same colour every time', () => {
    render(<BookCover book={book({ slug: 'gamebook' })} />);
    const first = host.querySelector<HTMLElement>('.bookcover--generated')?.style.cssText;

    render(<BookCover book={book({ slug: 'gamebook' })} />);
    expect(host.querySelector<HTMLElement>('.bookcover--generated')?.style.cssText).toBe(first);

    render(<BookCover book={book({ slug: 'chess' })} />);
    expect(host.querySelector<HTMLElement>('.bookcover--generated')?.style.cssText).not.toBe(first);
  });
});
