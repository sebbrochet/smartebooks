/**
 * Asks whether a gamebook can actually be played, as part of `lint:content`.
 *
 * The rules have existed since SPEC011 K4 and had never been run by anything an
 * author runs: their only caller was a unit test pointed at the bundled demo.
 * A book kept in its own repository — which is the case that cannot use the
 * vitest path at all — got directives, ids and assets checked, and was never
 * asked whether a reader could get stuck or be sent somewhere that does not
 * exist.
 *
 * **Nothing here re-implements a rule.** `checkBook` and the graph extraction
 * are imported from the pack, and the units come from the engine's own
 * splitter, so there is one implementation of each and no parity test to keep
 * honest. That is worth the type-stripping hook in `ts-hooks.mjs`: the
 * alternative was a second copy of a dominator computation.
 */
import { register } from 'node:module';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { BOOKS_DIR, deriveChapters, listContentFiles, readDescriptor } from './book-sources.mjs';

register('./ts-hooks.mjs', import.meta.url);

const { chapterUnits } = await import('../packages/engine/src/markdown/headings.ts');
const { graphOf, labelProblems } = await import('../packages/islands-gamebook/src/bookGraph.ts');
const { checkBook } = await import('../packages/islands-gamebook/src/check.ts');

/** The line a section's heading is on, so the output is somewhere to jump to. */
function lineOf(lines, depth, title) {
  const marker = `${'#'.repeat(depth)} ${title}`;
  const index = lines.findIndex((line) => line.trim() === marker);
  return index >= 0 ? index + 1 : 1;
}

export function checkGamebook(folder) {
  const descriptor = readDescriptor(folder);
  if (!descriptor.islands?.packs?.gamebook) return [];

  const depth = descriptor.unitDepth;
  if (!depth) {
    return [
      {
        folder,
        rule: 'gamebook-unitless',
        severity: 'warning',
        message:
          'declares the gamebook pack but no unitDepth, so it has no sections and cannot be checked',
      },
    ];
  }

  const files = listContentFiles(folder).map((path) => ({
    path,
    markdown: readFileSync(join(BOOKS_DIR, folder, path), 'utf8'),
  }));
  const byFile = new Map(files.map(({ path, markdown }) => [path.split('/').pop(), markdown]));

  /*
   * Assembled across **every** chapter, in the order the book reads.
   *
   * A gamebook numbers its sections straight through its files, so checking one
   * file at a time would report every choice that leaves it as a broken target.
   * That is worse than not checking at all, because an author learns to ignore
   * the output. It is also what makes two acts opening the same `## 1` a
   * `duplicate-id` error rather than a section that silently shadows another.
   */
  const units = [];
  const places = new Map();

  for (const chapter of deriveChapters(descriptor, files)) {
    const markdown = byFile.get(chapter.file) ?? '';
    const lines = markdown.split('\n');

    for (const unit of chapterUnits(markdown, depth).units) {
      units.push(unit);
      places.set(unit.id, [
        ...(places.get(unit.id) ?? []),
        { file: `content/${chapter.file}`, line: lineOf(lines, depth, unit.title) },
      ]);
    }
  }

  return [...checkBook(graphOf(units)), ...labelProblems(units)].map((problem) => {
    // A duplicate is reported where the *second* one is written; the first is
    // the one the book keeps, so it is not the line an author needs to open.
    const found = places.get(problem.section) ?? [];
    const at = problem.rule === 'duplicate-id' ? (found[1] ?? found[0]) : found[0];

    return {
      folder,
      file: at?.file,
      line: at?.line,
      rule: problem.rule,
      severity: problem.severity,
      message: problem.message,
    };
  });
}
