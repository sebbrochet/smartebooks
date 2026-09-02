// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import type { Book } from '@smart-ebooks/engine';
import { Bookshelf } from './Bookshelf';
import type { ShelfBook } from './books';

/**
 * Deleting an imported book is the one action on the shelf that cannot be
 * undone from the UI, and it used to happen on the click itself.
 *
 * These tests are about the *gap* between pressing Delete and the book going
 * away — that it exists, that every way out of the dialog other than the
 * confirm button leaves the book alone, and that a keyboard user is put
 * somewhere harmless.
 */

function shelfBook(title: string, importId?: string): ShelfBook {
  return {
    importId,
    trusted: false,
    book: {
      meta: { slug: importId ?? 'bundled', title },
      chapters: [{ slug: 'one', title: 'One', markdown: '# One' }],
      islands: {},
      assets: {},
    } as unknown as Book,
  } as ShelfBook;
}

let host: HTMLDivElement;
let root: Root;

// React needs telling that `act` is legitimate here, or every state update
// warns that the environment is not configured for it.
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

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

function render(onDelete: (importId: string) => void) {
  act(() => {
    root.render(
      <Bookshelf
        books={[shelfBook('Imported Demo Book', 'imp-demo'), shelfBook('A Bundled Book')]}
        onImported={() => {}}
        onDelete={onDelete}
      />,
    );
  });
}

const deleteButton = () =>
  host.querySelector<HTMLButtonElement>(
    'button[aria-label="Delete imported book Imported Demo Book"]',
  );
const dialog = () => document.querySelector('[role="alertdialog"]');
const button = (className: string) => document.querySelector<HTMLButtonElement>(`.${className}`);

function click(element: HTMLElement | null) {
  act(() => {
    element?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
}

function press(key: string, options: KeyboardEventInit = {}) {
  act(() => {
    document.activeElement!.dispatchEvent(
      new KeyboardEvent('keydown', { key, bubbles: true, ...options }),
    );
  });
}

describe('deleting an imported book', () => {
  it('asks first, and deletes nothing on the click itself', () => {
    const onDelete = vi.fn();
    render(onDelete);

    click(deleteButton());

    expect(onDelete).not.toHaveBeenCalled();
    expect(dialog()).not.toBeNull();
    // The book is named, so a reader with several imports knows which one.
    expect(dialog()?.textContent).toContain('Imported Demo Book');
  });

  it('deletes once the reader confirms', () => {
    const onDelete = vi.fn();
    render(onDelete);

    click(deleteButton());
    click(button('confirm__confirm'));

    expect(onDelete).toHaveBeenCalledExactlyOnceWith('imp-demo');
    expect(dialog()).toBeNull();
  });

  it.each([
    ['Cancel', () => click(button('confirm__cancel'))],
    ['the scrim', () => click(document.querySelector<HTMLElement>('.confirm__scrim'))],
    ['Escape', () => press('Escape')],
  ])('leaves the book alone when dismissed with %s', (_label, dismiss) => {
    const onDelete = vi.fn();
    render(onDelete);

    click(deleteButton());
    dismiss();

    expect(onDelete).not.toHaveBeenCalled();
    expect(dialog()).toBeNull();
  });

  /**
   * The dialog opens under a cursor that has just clicked and a finger that
   * may still be down. Focus has to land on the button that does nothing.
   */
  it('puts focus on Cancel, not on the destructive button', () => {
    render(vi.fn());
    click(deleteButton());

    expect(document.activeElement).toBe(button('confirm__cancel'));
  });

  it('returns focus to the delete button after cancelling', () => {
    render(vi.fn());
    deleteButton()?.focus();
    click(deleteButton());
    click(button('confirm__cancel'));

    expect(document.activeElement).toBe(deleteButton());
  });

  /**
   * A modal Tab can walk out of is a modal only for people using a mouse.
   *
   * Only the two wrap points are asserted: jsdom does not implement Tab
   * navigation, so movement *between* the buttons is the browser's to do and
   * cannot be observed here. The wraps are the part this component owns —
   * they are the keypresses it cancels — and an earlier version of this test
   * that stepped forward from Cancel passed against a dialog with no trap at
   * all, because nothing had moved.
   */
  it('keeps Tab inside the dialog', () => {
    render(vi.fn());
    click(deleteButton());

    // Forward from the last button wraps to the first.
    button('confirm__confirm')?.focus();
    press('Tab');
    expect(document.activeElement).toBe(button('confirm__cancel'));

    // Backward from the first wraps to the last.
    press('Tab', { shiftKey: true });
    expect(document.activeElement).toBe(button('confirm__confirm'));
  });

  it('offers no delete button for a bundled book', () => {
    render(vi.fn());
    expect(
      host.querySelector('button[aria-label="Delete imported book A Bundled Book"]'),
    ).toBeNull();
  });
});
