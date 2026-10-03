/**
 * Remove an author's HTML comments from a chapter, for the copy that goes into
 * a package (SPEC003 E1.6).
 *
 * The content in a `.smartbook` is a **compiled artefact**; the Markdown in the
 * author's repository is the source, and the two are allowed to differ. A
 * comment is the first thing that must: it never reaches the page
 * (`remarkRehype` runs without `allowDangerousHtml`) and is already kept out of
 * search, so the package was the last surface where an author's annotations —
 * a whole branching model, in some books — still travelled to the reader, in a
 * zip anyone can open.
 *
 * **Fence-aware, which is the whole difficulty.** `toPlainText` strips comments
 * with one regex and gets away with it because it deletes fenced blocks
 * wholesale first. Here a fence is content the reader is meant to see, so a
 * book demonstrating an HTML comment in an example has to keep it.
 */

/** An opening or closing code fence, per CommonMark: up to three spaces of indent. */
const FENCE = /^ {0,3}(`{3,}|~{3,})(.*)$/;

/**
 * A code span, a whole comment, or one that runs past the end of the line.
 *
 * Ordered: the span comes first so that an `` `<!-- x -->` `` written inside
 * backticks is matched as code and kept.
 */
const SPAN_OR_COMMENT = /(`+)[^`]*\1|<!--[\s\S]*?-->|<!--.*$/g;

function stripLine(line: string): { text: string; unterminated: boolean } {
  let unterminated = false;
  const text = line.replace(SPAN_OR_COMMENT, (match) => {
    if (match.startsWith('`')) return match;
    if (!match.endsWith('-->')) unterminated = true;
    return '';
  });
  return { text: text.replace(/[ \t]+$/, ''), unterminated };
}

function closesFence(line: string, marker: string): boolean {
  const match = FENCE.exec(line);
  return (
    match !== null &&
    match[1][0] === marker[0] &&
    match[1].length >= marker.length &&
    match[2].trim() === ''
  );
}

export function stripComments(markdown: string): string {
  const out: string[] = [];
  let fence: string | undefined;
  let inComment = false;

  for (const line of markdown.split('\n')) {
    if (inComment) {
      const end = line.indexOf('-->');
      if (end === -1) {
        out.push('');
        continue;
      }
      const rest = stripLine(line.slice(end + 3));
      inComment = rest.unterminated;
      out.push(rest.text);
      continue;
    }

    if (fence !== undefined) {
      out.push(line);
      if (closesFence(line, fence)) fence = undefined;
      continue;
    }

    const opening = FENCE.exec(line);
    if (opening) {
      fence = opening[1];
      out.push(line);
      continue;
    }

    const { text, unterminated } = stripLine(line);
    inComment = unterminated;
    // A comment-only line becomes blank rather than disappearing: an HTML
    // comment interrupts a paragraph, so removing the line outright would weld
    // the paragraphs either side of it into one.
    out.push(text);
  }

  return out.join('\n');
}
