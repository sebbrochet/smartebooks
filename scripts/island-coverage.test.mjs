/**
 * Run with `npm run test:scripts`.
 *
 * Every island the platform provides must be demonstrated by at least one
 * bundled book. The books under `books/` are the platform's own documentation
 * and its worked examples, so an island nobody uses there is one nobody has
 * seen working, and one no reviewer can eyeball after a change.
 *
 * This test exists because two islands had already slipped through: `mermaid`,
 * added the same day, and `chess-analysis`, which the chess book only ever used
 * as a *board attribute* (`analysis=on`) and never as a directive of its own.
 * Both were found by an ad-hoc script — which is precisely how the next one
 * would have been missed.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { BOOKS_DIR, ROOT, listBookFolders, listContentFiles } from './book-sources.mjs';
import { directiveNamesIn } from './lint-islands.mjs';

const contract = JSON.parse(readFileSync(join(ROOT, 'island-contract.json'), 'utf8'));

/** Every island the platform can provide, built-in or from a pack. */
const allIslands = [...contract.builtIn, ...Object.values(contract.packs).flat()];

/** Canonical names used anywhere under `books/`, with aliases resolved. */
function demonstratedIslands() {
  const aliases = contract.aliases ?? {};
  const seen = new Map();

  for (const folder of listBookFolders()) {
    for (const file of listContentFiles(folder)) {
      const markdown = readFileSync(join(BOOKS_DIR, folder, file), 'utf8');
      for (const name of directiveNamesIn(markdown)) {
        const canonical = aliases[name] ?? name;
        if (!seen.has(canonical)) seen.set(canonical, `${folder}/${file}`);
      }
    }
  }

  return seen;
}

describe('island coverage in the bundled books', () => {
  test('every island is demonstrated somewhere', () => {
    const demonstrated = demonstratedIslands();
    const missing = allIslands.filter((island) => !demonstrated.has(island));

    assert.deepEqual(
      missing,
      [],
      `These islands are provided but never used in books/: ${missing.join(', ')}. ` +
        `Add a worked example, or remove the island.`,
    );
  });

  // The inverse would mean a book renders a placeholder, which the content
  // linter already catches per book — this checks the contract file itself.
  test('every demonstrated directive is an island the platform provides', () => {
    const unknown = [...demonstratedIslands().keys()].filter((name) => !allIslands.includes(name));
    assert.deepEqual(unknown, []);
  });
});
