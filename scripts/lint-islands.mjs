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

import { BOOKS_DIR, listBookFiles, listContentFiles, readDescriptor } from './book-sources.mjs';

const CONTRACT = JSON.parse(
  readFileSync(new URL('../island-contract.json', import.meta.url), 'utf8'),
);

const parser = unified().use(remarkParse).use(remarkGfm).use(remarkDirective);

/** Island names a book may use: the built-ins plus the packs it declares. */
export function allowedIslands(descriptor) {
  const declared = Object.keys(descriptor.islands?.packs ?? {});
  const fromPacks = declared.flatMap((pack) => CONTRACT.packs[pack] ?? []);
  const names = new Set([...CONTRACT.builtIn, ...fromPacks]);

  // The full alias map, not filtered to this book: knowing that "chessboard"
  // means "chess-board" is what lets an error name the pack that provides it.
  const aliases = new Map(Object.entries(CONTRACT.aliases ?? {}));

  return { names, aliases, declaredPacks: declared };
}

/** Every directive in one Markdown source, with its name, id and position. */
function directivesIn(markdown) {
  const found = [];
  // A hand-written walk rather than `visit`, because one rule needs to know
  // what a directive is *inside*: a `::chess-board` in a `:::chess-game` saves
  // nothing, the container does. `visit` offers only the immediate parent, and
  // relying on that would break the moment a directive gained a wrapper.
  const walk = (node, ancestors) => {
    const isDirective =
      node.type === 'containerDirective' ||
      node.type === 'leafDirective' ||
      node.type === 'textDirective';

    if (isDirective) {
      const attributes = {};
      for (const [key, value] of Object.entries(node.attributes ?? {})) {
        if (typeof value === 'string') attributes[key] = value;
      }
      found.push({
        name: node.name,
        id: typeof attributes.id === 'string' ? attributes.id : undefined,
        attributes,
        inline: node.type === 'textDirective',
        ancestors,
        line: node.position?.start?.line ?? 0,
      });
    }

    const inner = isDirective ? [...ancestors, node.name] : ancestors;
    for (const child of node.children ?? []) walk(child, inner);
  };

  walk(parser.parse(markdown), []);
  return found;
}

/**
 * Does this directive save something for the reader under its own id?
 *
 * Usually a property of the island alone, but not always: a `::chess-board`
 * inside a `:::chess-game` saves nothing, because the container owns the
 * position for every board in it. The contract spells that out per island
 * (`{ name, unlessInside }`) rather than the linter knowing anything about
 * chess.
 */
function isStateful(canonicalName, ancestors) {
  const entry = (CONTRACT.stateful ?? []).find((it) =>
    typeof it === 'string' ? it === canonicalName : it.name === canonicalName,
  );
  if (!entry) return false;
  if (typeof entry === 'string') return true;
  return !ancestors.includes(entry.unlessInside);
}

/** Markdown image references, e.g. `![alt](assets/diagram.png)`. */
function imagesIn(markdown) {
  const found = [];
  visit(parser.parse(markdown), (node) => {
    if (node.type === 'image' && typeof node.url === 'string') {
      found.push({ url: node.url, line: node.position?.start?.line ?? 0 });
    }
  });
  return found;
}

/**
 * Check one directive's attributes against the island's declared schema.
 *
 * The runtime is forgiving (a bad value falls back to its default so a reader
 * never loses a page); this is where the author is told instead.
 */
function checkAttributes(island, attributes) {
  const specs = CONTRACT.attributes?.[island];
  if (!specs) return [];

  const problems = [];
  for (const [name, spec] of Object.entries(specs)) {
    const raw = attributes[name];

    if (raw === undefined) {
      if (spec.required) problems.push(`"${name}" is required`);
      continue;
    }

    if (spec.type === 'enum' && !spec.values.includes(raw)) {
      problems.push(`"${name}" must be one of ${spec.values.join(', ')} (got "${raw}")`);
    } else if (spec.type === 'number') {
      const value = Number(raw);
      if (!Number.isFinite(value)) {
        problems.push(`"${name}" must be a number (got "${raw}")`);
      } else if (spec.min !== undefined && value < spec.min) {
        problems.push(`"${name}" must be at least ${spec.min} (got ${value})`);
      } else if (spec.max !== undefined && value > spec.max) {
        problems.push(`"${name}" must be at most ${spec.max} (got ${value})`);
      }
    } else if (spec.type === 'boolean' && !BOOLEANS.has(raw.toLowerCase())) {
      problems.push(`"${name}" must be true or false (got "${raw}")`);
    }
  }
  return problems;
}

const BOOLEANS = new Set(['', 'true', 'yes', 'on', '1', 'false', 'no', 'off', '0']);

/**
 * Check the directives in a book's content.
 *
 * Pure: takes the descriptor and the already-read files, so it is testable
 * without a fixture book on disk. `validateBookContent` is the thin filesystem
 * wrapper around it.
 *
 * @param descriptor parsed smartbook.json
 * @param files      `[{ path, markdown }]`
 * @param folder     book folder name, used to label problems
 * @param assets     book-relative asset paths that exist (e.g. `assets/x.png`).
 *                   Omit when the asset list is unknown; the existence check is
 *                   then skipped rather than reporting everything as missing.
 */
export function checkDirectives(descriptor, files, folder = descriptor.slug, assets) {
  const problems = [];
  const { names, aliases, declaredPacks } = allowedIslands(descriptor);
  const packaged = assets ? new Set(assets) : undefined;

  // `file` and `line` are separate fields rather than a prefix inside the
  // message, so a caller can render `path:line: message` — which is what an
  // editor's problem matcher and an agent both need.
  const report = (severity, rule, message, file = 'smartbook.json', line = 1) =>
    problems.push({ folder, file, line, severity, rule, message });

  // A reference into the book's own package that the package does not contain.
  // Skipped entirely when the asset list is unknown.
  const isMissingAsset = (value) =>
    packaged !== undefined && value.startsWith('assets/') && !packaged.has(value);

  for (const pack of declaredPacks.filter((p) => !CONTRACT.packs[p])) {
    report(
      'error',
      'pack-unknown',
      `smartbook.json declares unknown island pack "${pack}". Known: ${Object.keys(CONTRACT.packs).join(', ')}.`,
    );
  }

  // An id is the key a book's saved progress hangs on, so two islands sharing
  // one silently share a reader's state (SPEC001 L3).
  const seenIds = new Map();

  for (const { path, markdown } of files) {
    for (const { name, id, attributes, inline, ancestors, line } of directivesIn(markdown)) {
      const at = `${path}:${line}`;

      if (!names.has(name)) {
        // Resolve the alias first, so a legacy spelling is diagnosed as the
        // island it means rather than as an unknown word.
        const canonical = aliases.get(name);

        if (canonical && names.has(canonical)) {
          // Available to this book: it still renders, so nudge rather than fail.
          report(
            'warning',
            'directive-alias',
            `":::${name}" is an old name for ":::${canonical}" — still works, but rename it.`,
            path,
            line,
          );
          continue;
        }

        const target = canonical ?? name;
        const spelling = canonical ? `":::${name}" (now ":::${canonical}")` : `":::${name}"`;
        const inAnotherPack = Object.entries(CONTRACT.packs).find(([, list]) =>
          list.includes(target),
        );
        report(
          'error',
          'directive-unknown',
          inAnotherPack
            ? `${spelling} needs the "${inAnotherPack[0]}" island pack, which this book does not declare.`
            : `${spelling} is not an island provided by this book.`,
          path,
          line,
        );
        continue;
      }

      // An inline island written as a block, or a block one written inside a
      // sentence, renders nothing useful: the engine keeps a text directive's
      // label and drops a block's body, so the two forms are not
      // interchangeable (SPEC001 P2.6).
      const canonicalName = names.has(name) ? name : (aliases.get(name) ?? name);
      const canonicalAncestors = ancestors.map((a) => (names.has(a) ? a : (aliases.get(a) ?? a)));
      const wantsInline = (CONTRACT.inline ?? []).includes(canonicalName);
      if (wantsInline !== inline) {
        report(
          'error',
          'directive-form',
          wantsInline
            ? `"${canonicalName}" is written inside a sentence, as ":${canonicalName}[label]".`
            : `"${canonicalName}" is a block directive — write it as "::${canonicalName}", not ":${canonicalName}[…]".`,
          path,
          line,
        );
        continue;
      }

      if (id !== undefined) {
        const previous = seenIds.get(id);
        if (previous) {
          report(
            'error',
            'id-duplicate',
            `id "${id}" is already used at ${previous} — they would share saved progress.`,
            path,
            line,
          );
        } else {
          seenIds.set(id, at);
        }
      } else if (isStateful(canonicalName, canonicalAncestors)) {
        // An island that saves something and has no id writes to a key like
        // `quiz:` — which every other id-less island of its kind in the book
        // also writes to, so two readers' answers become one. Silent at
        // runtime, invisible in review, and only the author can fix it.
        report(
          'error',
          'id-missing',
          `":::${name}" saves the reader's progress and needs an id.`,
          path,
          line,
        );
      }

      for (const detail of checkAttributes(name, attributes)) {
        report('error', 'attribute-invalid', `":::${name}" ${detail}.`, path, line);
      }

      // An attribute nothing reads. Every other attribute rule is about a bad
      // *value*; this one is about a good value in the wrong place, which the
      // forgiving runtime cannot report and which therefore did nothing and
      // said nothing (SPEC001 P1.2, 2026-09-01).
      for (const [attribute, spec] of Object.entries(CONTRACT.attributes?.[name] ?? {})) {
        if (attributes[attribute] === undefined) continue;

        if (spec.ignoredInside && canonicalAncestors.includes(spec.ignoredInside)) {
          report(
            'error',
            'attribute-ignored',
            `"${attribute}" does nothing on a ":::${name}" inside a ":::${spec.ignoredInside}", which owns it.`,
            path,
            line,
          );
        }

        if (spec.requiresInside && !canonicalAncestors.includes(spec.requiresInside)) {
          report(
            'error',
            'attribute-ignored',
            `"${attribute}" does nothing on a ":::${name}" outside a ":::${spec.requiresInside}".`,
            path,
            line,
          );
        }
      }

      // A packaged asset that isn't packaged fails silently at runtime: the
      // resolver returns nothing and the reader gets an empty player. The
      // author is the only person who can still fix it (SPEC001 P2.3).
      for (const [attribute, spec] of Object.entries(CONTRACT.attributes?.[name] ?? {})) {
        if (spec.type !== 'asset') continue;
        const raw = attributes[attribute];
        if (typeof raw === 'string' && isMissingAsset(raw)) {
          report(
            'error',
            'asset-missing',
            `":::${name}" ${attribute}="${raw}" does not exist in this book.`,
            path,
            line,
          );
        }
      }
    }

    // Images resolve through the same mechanism, and fail the same way.
    for (const { url, line } of imagesIn(markdown)) {
      if (!isMissingAsset(url)) continue;
      report('error', 'asset-missing', `image "${url}" does not exist in this book.`, path, line);
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
  return checkDirectives(descriptor, files, folder, listBookFiles(folder, 'assets'));
}

/**
 * The directive names used in one Markdown source, as written.
 *
 * Uses the real parser rather than a line-start regex, so a directive shown
 * *inside* a fenced example block is not mistaken for one the book uses.
 */
export function directiveNamesIn(markdown) {
  return [...new Set(directivesIn(markdown).map((directive) => directive.name))];
}

/**
 * The islands a book's content uses, by canonical name, for
 * `descriptor.islands.required` (SPEC001 P2.1).
 *
 * Mirrors the engine's `deriveRequiredIslands`, including the part that is easy
 * to get wrong: **anything already declared is kept**, even if unrecognised
 * here, so packaging never strips a requirement it merely fails to understand.
 *
 * @param descriptor parsed smartbook.json
 * @param files      `[{ path, markdown }]`
 */
export function usedIslands(descriptor, files) {
  const { names, aliases } = allowedIslands(descriptor);
  const required = new Set(descriptor.islands?.required ?? []);

  for (const { markdown } of files) {
    for (const { name } of directivesIn(markdown)) {
      const canonical = aliases.get(name) ?? name;
      if (names.has(canonical)) required.add(canonical);
    }
  }

  return [...required].sort();
}
