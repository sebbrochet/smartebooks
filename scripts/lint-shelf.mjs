/**
 * SPEC016 B1.7 — a bundled book shows a reader **what** the product does, never
 * **how** it is built. This rejects directive syntax that appears as *text* in a
 * book the platform ships.
 *
 * **It looks at syntax, never at vocabulary, and that is the whole reason it can
 * exist.** SPEC016 §7.2 recorded two ways the obvious version of this rule dies:
 * ids and filenames are not prose (`03-a-game-from-a-file.md` is in a reader's
 * URL and `chess-file-done` is in their saved progress, so renaming either costs
 * a reader their place to fix a word only this repository sees), and the same
 * word is jargon or not depending on the sentence — "engine" stayed where it
 * meant Stockfish and went where it meant the platform. A rule that cannot tell
 * those apart gets switched off. A token like `:::quiz{` cannot mean anything
 * else, so this one has no judgement in it at all.
 *
 * Scope is SPEC016 QB4: **only books this repository ships**. A book kept in its
 * own repository is nobody's shop window, and it reaches `lint:content` through
 * `SMART_EBOOKS_BOOKS_DIR` or as a symlink into `books/`.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  BOOKS_DIR,
  isLinkedBookFolder,
  listContentFiles,
  readDescriptor,
} from './book-sources.mjs';

/**
 * `::name` and `:::name`. Two colons or three is already a shape nothing else
 * has, so no bracket is required — a bare `` `:::quiz` `` in a sentence is the
 * thing being looked for.
 */
const BLOCK = /(?<!:):{2,3}[a-z][a-z0-9-]*/g;

/**
 * `:name[`. One colon is common punctuation, so the label bracket is required:
 * without it every `:smile:` and every `see :note` would be a finding.
 */
const INLINE = /(?<![:\w]):[a-z][a-z0-9-]*\[/g;

/** A directive only parses at the start of its line; `>` for a blockquote. */
const LINE_START = /^[\s>]*$/;

/** Spans are masked rather than removed so every index stays the line's own. */
function maskCodeSpans(line, onSpan) {
  return line.replace(/(`+)(.+?)\1/g, (match, ticks, content, index) => {
    onSpan(content, index + ticks.length);
    return ' '.repeat(match.length);
  });
}

/**
 * Every place a directive would be *read* rather than *run*, as
 * `{ line, token, where }`.
 *
 * Pure, so the judgement in it is testable without a book on disk.
 */
export function directivesAsText(markdown) {
  const found = [];
  let fence = null;

  for (const [index, line] of markdown.split('\n').entries()) {
    const at = index + 1;
    const ticks = /^\s*(`{3,}|~{3,})/.exec(line);

    if (fence) {
      if (ticks && ticks[1].startsWith(fence)) fence = null;
      else
        for (const token of tokensIn(line)) found.push({ line: at, token, where: 'a code block' });
      continue;
    }
    if (ticks) {
      fence = ticks[1];
      continue;
    }

    const masked = maskCodeSpans(line, (content) => {
      for (const token of tokensIn(content)) found.push({ line: at, token, where: 'a code span' });
    });

    // Outside code, only a block directive can be text: an inline `:name[…]`
    // parses wherever it appears, so it is live by construction.
    for (const match of masked.matchAll(BLOCK)) {
      if (LINE_START.test(masked.slice(0, match.index))) continue;
      found.push({
        line: at,
        token: match[0],
        where: 'the middle of a line, where it will not parse',
      });
    }
  }

  return found;
}

function tokensIn(text) {
  return [...text.matchAll(BLOCK), ...text.matchAll(INLINE)].map((match) => match[0]);
}

export function checkShelf(folder) {
  // A book from elsewhere is not on the shelf, whichever way it arrived.
  if (process.env.SMART_EBOOKS_BOOKS_DIR || isLinkedBookFolder(folder)) return [];

  const problems = [];
  const report = (file, line, token, where) =>
    problems.push({
      folder,
      file,
      line,
      rule: 'shelf-directive-as-text',
      message: `"${token}" is directive syntax shown as text in ${where}; a bundled book shows what the product does, not how a book is written`,
    });

  const description = readDescriptor(folder)?.description;
  if (description) {
    for (const { token, where } of directivesAsText(description)) {
      report('smartbook.json', 1, token, where);
    }
  }

  for (const file of listContentFiles(folder)) {
    const markdown = readFileSync(join(BOOKS_DIR, folder, file), 'utf8');
    for (const { line, token, where } of directivesAsText(markdown)) {
      report(file, line, token, where);
    }
  }

  return problems;
}
