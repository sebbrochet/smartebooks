/**
 * Minimal types for the Node-side packaging scripts.
 *
 * `scripts/*.mjs` are plain JavaScript because they must run without a
 * TypeScript loader (see SPEC006 F1.2). `exportParity.test.ts` imports two of
 * them to check the CLI packager and the browser exporter still derive the same
 * descriptor, so they need *some* type. Declared here rather than converting
 * the scripts, and deliberately narrow: only what the parity test uses.
 */

interface ChapterSource {
  path: string;
  markdown: string;
}

interface ChapterEntry {
  file: string;
  order: number;
  title: string;
  /**
   * Optional, matching `SmartbookChapterEntry`. Absent here originally, which
   * is part of why the CLI silently dropping it went unnoticed: the parity
   * test compared two objects that neither carried nor could describe a part.
   */
  part?: string;
}

declare module '*/book-sources.mjs' {
  export function deriveChapters(descriptor: unknown, files: ChapterSource[]): ChapterEntry[];
}

declare module '*/lint-islands.mjs' {
  export function usedIslands(descriptor: unknown, files: ChapterSource[]): string[];
}
