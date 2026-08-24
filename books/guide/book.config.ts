import { makeBook, defaultIslands, type Book } from '@smart-ebooks/engine';
import descriptor from './smartbook.json';

const modules = import.meta.glob('./content/*.md', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

// Package this book's own assets, exactly like an imported `.smartbook` does:
// bytes on the book, resolved to Blob URLs at render and included on export.
// SVG is text, so `?raw` round-trips it losslessly.
const assetSources = import.meta.glob('./assets/*.svg', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

const encoder = new TextEncoder();
const assets = Object.fromEntries(
  Object.entries(assetSources).map(([path, source]) => [
    path.replace(/^\.\//, ''),
    encoder.encode(source),
  ]),
);

// This book uses only the built-in islands.
export const book: Book = {
  ...makeBook(descriptor, modules, defaultIslands),
  assets,
};
