/**
 * Run with `npm run test:scripts`.
 *
 * `editorial-charter.md` calls itself the authoring contract and says it is
 * kept in step with `island-contract.json`. Nothing checked that, and it drifted
 * twice: once when directives were renamed (recorded in `specs/_index.md`), and
 * again when the timed-media islands were deleted and the charter went on
 * offering authors `::video` and `::audio` — two directives that fail the build.
 *
 * Both times a person had to notice. This is the same move as SPEC016 B1.7:
 * turn a rule somebody has to remember into one the gate enforces.
 *
 * **It checks directives as written, not as spelled.** Requiring the charter to
 * merely *contain* the word `note` would pass against a file that never shows
 * the directive, and `note` is a substring of ordinary prose besides. Every
 * directive has to appear in directive form — `:::quiz`, `::checkpoint`,
 * `:note[…]` — which is the charter doing its job rather than mentioning it.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT } from './book-sources.mjs';

const contract = JSON.parse(readFileSync(join(ROOT, 'island-contract.json'), 'utf8'));
const charter = readFileSync(join(ROOT, 'editorial-charter.md'), 'utf8');

const declared = [
  ...new Set([...contract.builtIn, ...Object.values(contract.packs).flat(), ...contract.inline]),
].sort();

/** Canonical names plus the concatenated spellings the linter still accepts. */
const known = new Set([...declared, ...Object.keys(contract.aliases)]);

/**
 * §3 teaches the syntax with `name` standing in for a real directive, so the
 * generic forms are not claims about the vocabulary.
 */
const PLACEHOLDERS = new Set(['name']);

const BLOCK = /(?<!:):{2,3}([a-z][a-z0-9-]*)/g;
/** A label is optional, so `:restart{to="1"}` is as real as `:move[2. Bc4]`. */
const INLINE = /(?<![:\w]):([a-z][a-z0-9-]*)[[{]/g;

/** Every directive the charter actually writes, in either form. */
const written = new Set(
  [...charter.matchAll(BLOCK), ...charter.matchAll(INLINE)].map((match) => match[1]),
);

describe('editorial-charter.md', () => {
  test('shows every directive an author may write', () => {
    const missing = declared.filter((name) => !written.has(name));
    assert.deepEqual(missing, [], `the contract declares these and the charter never shows them`);
  });

  test('shows no directive the contract does not declare', () => {
    const strays = [...written].filter((name) => !known.has(name) && !PLACEHOLDERS.has(name));
    assert.deepEqual(strays.sort(), [], `the charter offers these and the build would refuse them`);
  });

  test('names every pack a book has to declare', () => {
    const undocumented = Object.keys(contract.packs).filter(
      (pack) => !new RegExp(`pack:\\s*\`${pack}\``).test(charter),
    );
    assert.deepEqual(undocumented, []);
  });

  // Deliberately not checked: attribute names. Most of them are ordinary words
  // — `to`, `at`, `src`, `title` — so a substring search would pass against a
  // charter that documents none of them, which is worse than no test at all.
});
