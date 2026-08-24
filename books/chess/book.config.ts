import { makeBook, defaultIslands, type Book } from '@smart-ebooks/engine';
import { chessIslands } from '@smart-ebooks/islands-chess';
import descriptor from './smartbook.json';

const modules = import.meta.glob('./content/*.md', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

// The built-in islands plus the chess domain islands. Only books that declare
// them can use `:::chessboard` / `:::chesspuzzle` / `::chessanalysis`, and the
// board defaults below apply to this book alone.
export const book: Book = makeBook(descriptor, modules, [
  ...defaultIslands,
  ...chessIslands({ board: { theme: 'blue' } }),
]);
