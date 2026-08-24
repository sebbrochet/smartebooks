import { makeBook, defaultIslands, type Book } from '@smart-ebooks/engine';
import descriptor from './smartbook.json';

const modules = import.meta.glob('./content/*.md', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

// This book uses only the built-in islands.
export const book: Book = makeBook(descriptor, modules, defaultIslands);
