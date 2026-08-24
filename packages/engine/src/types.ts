import type { ComponentType, LazyExoticComponent, ReactNode } from 'react';
import type { SmartbookDescriptor } from './package/spec';
import type { IslandDefinition } from './islandRegistry';

/**
 * A parsed quiz question, extracted from a `:::quiz` directive at build/parse time
 * so the interactive island receives clean structured data.
 */
export interface QuizOption {
  text: string;
  correct: boolean;
}

export interface QuizQuestion {
  prompt: string;
  options: QuizOption[];
  explanation?: string;
  multi: boolean;
}

/**
 * A parsed flashcard, extracted from a `:::flashcard` directive.
 */
export interface FlashcardData {
  front: string;
  back: string;
}

/**
 * Props every interactive island receives. `id` keys its persisted state,
 * `attributes` are the raw directive attributes, `data` is any pre-parsed config.
 */
export interface IslandComponentProps {
  id: string;
  attributes: Record<string, string>;
  data?: unknown;
  children?: ReactNode;
}

export type IslandComponent =
  ComponentType<IslandComponentProps> | LazyExoticComponent<ComponentType<IslandComponentProps>>;

/**
 * A single chapter of a book: its slug (from filename), display order, title
 * (first heading), and raw Markdown source.
 */
export interface Chapter {
  slug: string;
  order: number;
  title: string;
  markdown: string;
}

/** Book-level metadata provided by each book's `book.config`. */
export interface BookMeta {
  slug: string;
  title: string;
  description?: string;
  /** Cover image path (usually `assets/…`), resolved at render time. */
  cover?: string;
  authors?: string[];
}

/** A complete book: metadata plus its ordered chapters. */
export interface Book {
  meta: BookMeta;
  chapters: Chapter[];
  /** The `smartbook.json` descriptor this book was built from. */
  descriptor: SmartbookDescriptor;
  /** Packaged asset bytes by path (e.g. `assets/cover.png`), for imported books. */
  assets?: Record<string, Uint8Array>;
  /**
   * The islands this book may use. The book is scoped to exactly these — a
   * directive naming any other island renders as "unknown". Bundled books
   * declare this in `book.config.ts`; imported books (which ship no code) are
   * given the built-in set.
   */
  islands: IslandDefinition[];
}
