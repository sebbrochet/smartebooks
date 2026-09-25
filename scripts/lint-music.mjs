/**
 * Asks whether the music in a book can actually be heard, as part of
 * `lint:content`.
 *
 * The music islands fail *quietly*, deliberately: an unparseable tune engraves
 * nothing rather than losing the page, and a `:note[…]` naming a note that is
 * not there renders as plain text instead of a button. Both are invisible in a
 * diff and stay invisible until someone opens that chapter with the sound on.
 * Chess has had this guard since `check-games.mjs`; music shipped without it,
 * and a deliberately broken reference was verified to pass the whole gate.
 *
 * **Nothing here re-implements the pack.** `notesOf` and `findNote` are the
 * same functions the reader runs, imported through `ts-hooks.mjs`, so there is
 * one ABC parser and no parity test to keep honest.
 */
import { register } from 'node:module';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { BOOKS_DIR, listContentFiles, readDescriptor } from './book-sources.mjs';

register('./ts-hooks.mjs', import.meta.url);

const { notesOf, findNote } = await import('../packages/islands-music/src/notes.ts');

/**
 * A container that holds a tune. Alias spellings are accepted because the
 * engine accepts them: a book using `:::musicpiece` renders, so it must also
 * be checked.
 */
const OPENER = /^:::(music-?figure|music-?piece)\{([^}]*)\}\s*$/;

/** The lookbehind keeps this from matching the tail of a `::note[…]`. */
const NOTE = /(?<!:):note\[([^\]]+)\](?:\{([^}]*)\})?/g;

/** Accepts `nth=3` and `nth="3"`; the engine's attribute parser accepts both. */
function nthOf(attributes) {
  return Number(/\bnth=["']?(\d+)/.exec(attributes ?? '')?.[1] ?? 1);
}

function attributeOf(attributes, name) {
  return new RegExp(`\\b${name}="([^"]*)"`).exec(attributes)?.[1];
}

/**
 * Every music container in a file, with the lines it covers.
 *
 * Scanned line by line rather than matched with one large regex: the body of a
 * container holds a fenced block whose content is arbitrary, and the line scan
 * tracks the fence instead of guessing where it ends. It also gives every
 * diagnostic an exact line without a second search through the text.
 */
function blocksIn(markdown) {
  const lines = markdown.split('\n');
  const blocks = [];

  for (let index = 0; index < lines.length; index++) {
    const opener = OPENER.exec(lines[index]);
    if (!opener) continue;

    const body = [];
    let fence = null;
    let end = lines.length;

    for (let cursor = index + 1; cursor < lines.length; cursor++) {
      const line = lines[cursor];
      const ticks = /^\s*(`{3,})\s*(\S*)/.exec(line);

      if (fence === null && ticks) {
        fence = { marker: ticks[1], language: ticks[2], from: cursor };
        continue;
      }
      if (fence !== null) {
        if (ticks && ticks[1].startsWith(fence.marker) && !ticks[2]) {
          body.push({ fenced: fence.language, lines: lines.slice(fence.from + 1, cursor) });
          fence = null;
        }
        continue;
      }
      if (line.trim() === ':::') {
        end = cursor;
        break;
      }
      body.push({ line, at: cursor + 1 });
    }

    blocks.push({
      kind: opener[1].includes('piece') ? 'piece' : 'figure',
      attributes: opener[2],
      line: index + 1,
      from: index + 1,
      to: end + 1,
      fences: body.filter((part) => part.fenced !== undefined),
      prose: body.filter((part) => part.line !== undefined),
    });

    index = end;
  }

  return blocks;
}

export function checkMusic(folder) {
  const descriptor = readDescriptor(folder);
  if (!descriptor?.islands?.packs?.music) return [];

  const problems = [];

  for (const file of listContentFiles(folder)) {
    const markdown = readFileSync(join(BOOKS_DIR, folder, file), 'utf8');
    const blocks = blocksIn(markdown);
    const report = (line, rule, message, severity) =>
      problems.push({ folder, file, line, rule, message, severity });

    for (const block of blocks) {
      const src = attributeOf(block.attributes, 'src');
      const inline = block.fences.find((part) => part.fenced === 'abc');
      let abc;

      if (src && inline) {
        // `useAbcSource` prefers the file, so the fenced tune is not rendered
        // and the author is looking at a score that is not the one they edited.
        report(
          block.line,
          'music-two-tunes',
          `names src="${src}" and also holds a tune inline; the file wins and the inline tune is never drawn`,
        );
      }

      if (src) {
        if (!src.endsWith('.abc')) {
          // `.mxl` looks like a sibling of `.musicxml` and is a ZIP, so it
          // cannot be read as text at all (SPEC017 QN8).
          report(
            block.line,
            'music-source-format',
            src.endsWith('.mxl')
              ? `src="${src}" is compressed MusicXML, which is a ZIP; only text .abc is read`
              : `src="${src}" is not a .abc file; only .abc is read today`,
          );
          continue;
        }
        const path = join(BOOKS_DIR, folder, src);
        // A missing asset is already the asset rule's diagnostic; saying it
        // twice in different words helps nobody.
        if (!existsSync(path)) continue;
        abc = readFileSync(path, 'utf8');
      } else if (inline) {
        abc = inline.lines.join('\n');
      } else {
        report(block.line, 'music-no-tune', 'has no tune: no ```abc body and no src');
        continue;
      }

      const notes = notesOf(abc);
      if (notes.length === 0) {
        // The failure that looks most like success: the island renders, and
        // renders an empty stave.
        report(
          block.line,
          'music-silent-tune',
          src
            ? `src="${src}" parses to no notes at all`
            : 'its abc parses to no notes at all, so the stave draws empty',
        );
        continue;
      }

      if (block.kind !== 'piece') continue;

      for (const { line, at } of block.prose) {
        for (const mark of line.matchAll(NOTE)) {
          const label = mark[1];
          const nth = nthOf(mark[2]);
          if (findNote(notes, label, nth) !== undefined) continue;
          const times = notes.filter((note) => note.name === label.trim().toUpperCase()).length;
          report(
            at,
            'music-note-unresolved',
            `:note[${label}]${nth > 1 ? `{nth=${nth}}` : ''} names no note in the tune` +
              (times > 0 ? ` (there are only ${times})` : ''),
          );
        }
      }
    }

    // A mark outside a piece has no sequence to write to, so it renders as
    // plain text. This also catches the checker itself going blind: if OPENER
    // stops matching, every mark in the book lands here rather than the file
    // passing over zero tunes.
    const covered = (line) =>
      blocks.some((block) => block.kind === 'piece' && line >= block.from && line <= block.to);

    for (const [index, line] of markdown.split('\n').entries()) {
      if (covered(index + 1)) continue;
      for (const mark of line.matchAll(NOTE)) {
        report(
          index + 1,
          'music-note-loose',
          `:note[${mark[1]}] is not inside a music-piece, so it renders as plain text`,
        );
      }
    }
  }

  return problems;
}
