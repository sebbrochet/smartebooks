// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react';
import MoveList from './MoveList';
import { pgnToTree } from './tree';

const SCHOLARS = '1. e4 e5 2. Bc4 Nc6 3. Qh5 Nf6?? 4. Qxf7#';

/** The second move: inside the list rather than at its head. */
const SECOND = '0.0';

let root: Root | undefined;
let host: HTMLDivElement | undefined;

afterEach(() => {
  act(() => root?.unmount());
  host?.remove();
  root = undefined;
  host = undefined;
  delete (Element.prototype as Partial<Element>).scrollIntoView;
  vi.restoreAllMocks();
});

function render(path: string) {
  const tree = pgnToTree(SCHOLARS);
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
  act(() => {
    root?.render(<MoveList tree={tree} path={path} onSelect={() => {}} scroll />);
  });
}

/**
 * SPEC008. The list follows the reader inside its own scrollport, and that must
 * not move the page behind it.
 *
 * **This asserts the call, not the resulting scroll position.** The property
 * that matters — *the document did not move* — is the one this repository has
 * already found untestable in practice: whether `scrollIntoView` moves anything
 * depends on whether the element happens to be in view already, so the same bug
 * surfaced as a **flaky** end-to-end test three times running and was written
 * off as contention each time. The call is the defect, and the call is stable.
 */
describe('MoveList keeping the current move in view', () => {
  it('never uses scrollIntoView, which would scroll the page with it', () => {
    // jsdom does not implement it, so it has to be put there before its absence
    // can mean anything — and defining it is what makes the assertion strong:
    // the method is available and still goes uncalled.
    const scrollIntoView = vi.fn();
    Object.defineProperty(Element.prototype, 'scrollIntoView', {
      value: scrollIntoView,
      configurable: true,
      writable: true,
    });

    render(SECOND);

    expect(scrollIntoView).not.toHaveBeenCalled();
  });

  it('still marks the move the reader is on, so there is something to follow', () => {
    render(SECOND);
    expect(host?.querySelector('[aria-current="true"]')).not.toBeNull();
  });
});
