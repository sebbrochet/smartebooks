/**
 * Parses a book's Markdown and checks the island directives an author used.
 *
 * Uses the same parser the engine does (`remark-parse` + `remark-directive`),
 * so what the linter sees is what the reader will see — a regex would drift on
 * fenced blocks, escapes and inline directives.
 *
 * Part of SPEC001 P1.3. Diagnostics carry a stable `rule` id so an agent can
 * act on them, not just a human (SPEC006 F1.3).
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkDirective from 'remark-directive';
import { visit } from 'unist-util-visit';

import { BOOKS_DIR, listContentFiles, readDescriptor } from './book-sources.mjs';

const CONTRACT = JSON.parse(
  readFileSync(new URL('../island-contract.json', import.meta.url), 'utf8'),
);

const parser = unified().use(remarkParse).use(remarkGfm).use(remarkDirective);

/** Island names a book may use: the built-ins plus the packs it declares. */
export function allowedIslands(descriptor) {
  const declared = Object.keys(descriptor.islands?.packs ?? {});
  const fromPacks = declared.flatMap((pack) => CONTRACT.packs[pack] ?? []);
  return { names: new Set([...CONTRACT.builtIn, ...fromPacks]), declaredPacks: declared };
}

/** Every directive in one Markdown source, with its name, id and position. */
function directivesIn(markdown) {
  const found = [];
  visit(parser.parse(markdown), (node) => {
    if (
      node.type !== 'containerDirective' &&
      node.type !== 'leafDirective' &&
      node.type !== 'textDirective'
    ) {
      return;
    }
    found.push({
      name: node.name,
      id: typeof node.attributes?.id === 'string' ? node.attributes.id : undefined,
      line: node.position?.start?.line ?? 0,
    });
  });
  return found;
}

/**
 * Check the directives in a book's content.
 *
 * Pure: takes the descriptor and the already-read files, so it is testable
 * without a fixture book on disk. `validateBookContent` is the thin filesystem
 * wrapper around it.
 *
 * @param descriptor parsed smartbook.json
 * @param files      `[{ path, markdown }]`
 */
export function checkDirectives(descriptor, files, folder = descriptor.slug) {
  const problems = [];
  const { names, declaredPacks } = allowedIslands(descriptor);

  for (const pack of declaredPacks.filter((p) => !CONTRACT.packs[p])) {
    problems.push({
      folder,
      rule: 'pack-unknown',
      message: `smartbook.json declares unknown island pack "${pack}". Known: ${Object.keys(CONTRACT.packs).join(', ')}.`,
    });
  }

  // An id is the key a book's saved progress hangs on, so two islands sharing
  // one silently share a reader's state (SPEC001 L3).
  const seenIds = new Map();

  for (const { path, markdown } of files) {
    for (const { name, id, line } of directivesIn(markdown)) {
      const at = `${path}:${line}`;

      if (!names.has(name)) {
        const inAnotherPack = Object.entries(CONTRACT.packs).find(([, list]) =>
          list.includes(name),
        );
        problems.push({
          folder,
          rule: 'directive-unknown',
          message: inAnotherPack
            ? `${at}: ":::${name}" needs the "${inAnotherPack[0]}" island pack, which this book does not declare.`
            : `${at}: ":::${name}" is not an island provided by this book.`,
        });
        continue;
      }

      if (id !== undefined) {
        const previous = seenIds.get(id);
        if (previous) {
          problems.push({
            folder,
            rule: 'id-duplicate',
            message: `${at}: id "${id}" is already used at ${previous} — they would share saved progress.`,
          });
        } else {
          seenIds.set(id, at);
        }
      }
    }
  }

  return problems;
}

/** Read a book's content from disk and check its directives. */
export function validateBookContent(folder) {
  const descriptor = readDescriptor(folder);
  const files = listContentFiles(folder).map((path) => ({
    path,
    markdown: readFileSync(join(BOOKS_DIR, folder, path), 'utf8'),
  }));
  return checkDirectives(descriptor, files, folder);
}
