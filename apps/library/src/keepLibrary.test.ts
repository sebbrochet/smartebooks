// @vitest-environment jsdom
import { describe, it, expect, afterEach, beforeAll, vi } from 'vitest';
import { keepLibrary } from './keepLibrary';

/**
 * `navigator.storage` is not configurable in jsdom the way a spy would like, so
 * each case installs the shape it wants and the suite puts back what it found.
 */
let original: PropertyDescriptor | undefined;

beforeAll(() => {
  original = Object.getOwnPropertyDescriptor(navigator, 'storage');
});

function withStorage(storage: unknown) {
  Object.defineProperty(navigator, 'storage', { value: storage, configurable: true });
}

afterEach(() => {
  if (original) Object.defineProperty(navigator, 'storage', original);
});

describe('keeping the library', () => {
  it('asks the browser to keep it', async () => {
    const persist = vi.fn().mockResolvedValue(true);
    withStorage({ persist, persisted: vi.fn().mockResolvedValue(false) });

    expect(await keepLibrary()).toBe(true);
    expect(persist).toHaveBeenCalled();
  });

  it('does not ask twice when it is already persistent', async () => {
    const persist = vi.fn();
    withStorage({ persist, persisted: vi.fn().mockResolvedValue(true) });

    expect(await keepLibrary()).toBe(true);
    // Asking again is not free — Chrome may show a prompt — and the answer is
    // already yes.
    expect(persist).not.toHaveBeenCalled();
  });

  it('reports a refusal rather than pretending', async () => {
    withStorage({
      persist: vi.fn().mockResolvedValue(false),
      persisted: vi.fn().mockResolvedValue(false),
    });

    expect(await keepLibrary()).toBe(false);
  });

  it('is quiet where the API does not exist', async () => {
    // Older WebKit, and anything running without a secure context. A reader
    // importing a book should not meet an error about a storage API.
    withStorage(undefined);
    expect(await keepLibrary()).toBe(false);

    withStorage({});
    expect(await keepLibrary()).toBe(false);
  });

  it('is quiet when the browser throws', async () => {
    withStorage({
      persisted: vi.fn().mockRejectedValue(new Error('denied')),
      persist: vi.fn(),
    });

    expect(await keepLibrary()).toBe(false);
  });
});
