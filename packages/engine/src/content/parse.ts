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
      // Never reaches the page either: `remarkRehype` runs without
      // `allowDangerousHtml`, so a comment is invisible to a reader and was
      // searchable — which is where authoring notes and bookkeeping live.
      .replace(/<!--[\s\S]*?-->/g, ' ')
      .replace(/^:::.*$/gm, ' ') // container directive fences
      .replace(/^::.*$/gm, ' ') // leaf directives
      /*
       * Inline directives sit *inside* a sentence, so unlike the two above they
       * cannot be found by line — which is why searching the ordinary word
       * "choice" used to return `:choice{to="2"}` in the snippet.
       *
       * The label is kept because it is the text the page shows; the
       * attributes are dropped because they are not. Each form requires a
       * bracket or a brace, so prose keeps its colons: "He said: run" and
       * "10:30" are not directives.
       */
      .replace(/:[a-z][a-z0-9-]*\[([^\]]*)\]\{[^}]*\}/g, '$1')
      .replace(/:[a-z][a-z0-9-]*\[([^\]]*)\]/g, '$1')
      .replace(/:[a-z][a-z0-9-]*\{[^}]*\}/g, '')
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
