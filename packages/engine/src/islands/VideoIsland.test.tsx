// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createRoot, type Root } from 'react-dom/client';
import { act, type ReactNode } from 'react';
import { VideoIsland } from './VideoIsland';
import { BookProvider } from '../reader/BookContext';
import { createIslandRegistry } from '../islandRegistry';

// jsdom has no IndexedDB, so back idb-keyval with an in-memory map.
const { memStore } = vi.hoisted(() => ({ memStore: new Map<string, unknown>() }));

vi.mock('idb-keyval', () => ({
  get: async (key: string) => memStore.get(key),
  set: async (key: string, value: unknown) => {
    memStore.set(key, value);
  },
  del: async (key: string) => {
    memStore.delete(key);
  },
  entries: async () => [...memStore.entries()],
  createStore: () => undefined,
}));

const registry = createIslandRegistry([]);

function book(node: ReactNode, trusted = true) {
  return (
    <BookProvider slug="demo" trusted={trusted} registry={registry}>
      {node}
    </BookProvider>
  );
}

const youtube = (
  <VideoIsland
    id="v1"
    attributes={{ src: 'https://youtu.be/aqz-KE-bpKQ', title: 'A film' }}
    packagedAssets={[]}
  />
);

let host: HTMLDivElement;
let root: Root;

function mount(node: ReactNode) {
  act(() => {
    root.render(node);
  });
}

const facade = () => host.querySelector<HTMLButtonElement>('.video__facade');
const iframe = () => host.querySelector('iframe');

beforeEach(() => {
  memStore.clear();
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

/**
 * The embed used to be rendered with the chapter, so a page with three videos
 * announced the reader to Google three times before they touched anything, and
 * the `media:` flag was set from the iframe's `onLoad` — recording "watched"
 * for a video nobody played.
 */
describe('a YouTube video', () => {
  it('contacts nobody until the reader presses play', () => {
    mount(book(youtube));

    expect(iframe()).toBeNull();
    expect(facade()).not.toBeNull();
    // Not a poster from i.ytimg.com either: that would be the same request
    // wearing a different hat.
    expect(host.querySelector('img')).toBeNull();
  });

  it('loads the embed when asked, from the privacy-enhanced host', () => {
    mount(book(youtube));
    act(() => facade()?.click());

    const src = iframe()?.getAttribute('src') ?? '';
    expect(src).toContain('youtube-nocookie.com/embed/aqz-KE-bpKQ');
    expect(src).not.toContain('//www.youtube.com');
    // One press should play, not merely load a player to press again.
    expect(src).toContain('autoplay=1');
  });

  it('normalises a watch URL to the same embed', () => {
    mount(
      book(
        <VideoIsland
          id="v2"
          attributes={{ src: 'https://www.youtube.com/watch?v=aqz-KE-bpKQ' }}
          packagedAssets={[]}
        />,
      ),
    );
    act(() => facade()?.click());
    expect(iframe()?.getAttribute('src')).toContain('youtube-nocookie.com/embed/aqz-KE-bpKQ');
  });

  it('offers the reader a control they can name', () => {
    mount(book(youtube));
    expect(facade()?.getAttribute('aria-label')).toMatch(/play a film/i);
    // And says where it is about to send them, before it sends them.
    expect(host.textContent).toMatch(/loads from youtube/i);
  });
});

describe('a direct or packaged file', () => {
  const file = (
    <VideoIsland id="v3" attributes={{ src: 'assets/clip.mp4' }} packagedAssets={['src']} />
  );

  it('is a native player, with nothing fetched up front', () => {
    mount(book(file));

    const video = host.querySelector('video');
    expect(video).not.toBeNull();
    expect(video?.getAttribute('preload')).toBe('none');
    expect(facade()).toBeNull();
  });
});
