import { makeBook, packBookAssets, defaultIslands, type Book } from '@smart-ebooks/engine';
import descriptor from './smartbook.json';

const modules = import.meta.glob('./content/*.md', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

// Package this book's own assets, exactly like an imported `.smartbook` does:
// bytes on the book, resolved to Blob URLs at render and included on export.
// Text assets round-trip through `?raw`; small binaries come in as data URLs.
const assets = packBookAssets({
  ...import.meta.glob('./assets/*.svg', { query: '?raw', import: 'default', eager: true }),
  ...import.meta.glob('./assets/*.wav', { query: '?inline', import: 'default', eager: true }),
} as Record<string, string>);

// This book uses only the built-in islands.
export const book: Book = {
  ...makeBook(descriptor, modules, defaultIslands),
  assets,
};
