/**
 * Lightweight helpers for turning chapter Markdown into metadata used by the
 * reader shell (titles) and the search index (plain text). Intentionally
 * dependency-free and forgiving.
 */

/** The first level-1 heading, or a fallback (usually the slug). */
export function extractTitle(markdown: string, fallback: string): string {
  const match = markdown.match(/^#\s+(.+?)\s*$/m);
  return match ? match[1].trim() : fallback;
}

/** A rough plain-text rendering of a chapter, good enough for search. */
export function toPlainText(markdown: string): string {
  return (
    markdown
      .replace(/```[\s\S]*?```/g, ' ') // fenced code / game JSON
      .replace(/^:::.*$/gm, ' ') // container directive fences
      .replace(/^::.*$/gm, ' ') // leaf directives
      .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ') // images
      .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1') // links -> text
      // List scaffolding, which is punctuation a reader never sees. Quiz
      // options are ordinary task-list items, so without this a search snippet
      // reads "- [x] Locally in your browser" instead of the sentence.
      .replace(/^\s{0,8}[-*+]\s+\[[ xX]\]\s*/gm, ' ') // task list markers
      .replace(/^\s{0,8}[-*+]\s+/gm, ' ') // bullets
      .replace(/^\s{0,8}\d+[.)]\s+/gm, ' ') // numbered items
      .replace(/[#>*_`|~]/g, ' ') // markdown punctuation
      .replace(/\s+/g, ' ')
      .trim()
  );
}
