/**
 * Run with `npm run test:scripts`.
 *
 * `smartbook.schema.json` gives editors completion, validation and hover docs
 * for a book's descriptor. It is a second description of a shape that already
 * exists in `packages/engine/src/package/spec.ts`, and this repository has been
 * bitten by hand-mirrored contracts before (`island-contract.json` needs a sync
 * test for exactly that reason). These are that test.
 *
 * The schema is deliberately *stricter* than the TypeScript type in one place:
 * `visibility` is optional in TS, because an imported package may omit it, but
 * required here, because the linter demands it of a book in this repository.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, listBookFolders, readDescriptor } from './book-sources.mjs';

const schema = JSON.parse(readFileSync(join(ROOT, 'smartbook.schema.json'), 'utf8'));
const declared = Object.keys(schema.properties);

/** Field names on `SmartbookDescriptor`, read from the source of truth. */
function fieldsInSpec() {
  const source = readFileSync(
    join(ROOT, 'packages', 'engine', 'src', 'package', 'spec.ts'),
    'utf8',
  );
  const body = source.match(/export interface SmartbookDescriptor \{([\s\S]*?)\n\}/);
  assert.ok(body, 'could not find SmartbookDescriptor in spec.ts');

  return [...body[1].matchAll(/^\s{2}(\w+)\??:/gm)].map((match) => match[1]);
}

describe('smartbook.schema.json', () => {
  test('describes every field the descriptor type declares', () => {
    const missing = fieldsInSpec().filter((field) => !declared.includes(field));
    assert.deepEqual(
      missing,
      [],
      `spec.ts declares fields the schema does not: ${missing.join(', ')}`,
    );
  });

  test('describes nothing the descriptor type does not', () => {
    const fields = fieldsInSpec();
    const extra = declared.filter((name) => !fields.includes(name));
    assert.deepEqual(extra, [], `schema declares fields spec.ts does not: ${extra.join(', ')}`);
  });

  test('requires what the linter requires', () => {
    // A book that satisfies the schema must also pass `lint:content` — if the
    // schema were laxer, the editor would go quiet about a build-breaking book.
    assert.ok(schema.required.includes('visibility'));
    assert.ok(schema.required.includes('slug'));
    assert.ok(schema.required.includes('title'));
    assert.ok(schema.required.includes('schemaVersion'));
  });

  test('rejects unknown fields, so a typo is visible', () => {
    assert.equal(schema.additionalProperties, false);
  });

  // The bundled books are the worked examples; if the schema disagrees with
  // them, one of the two is wrong.
  test('accepts every bundled book', () => {
    for (const folder of listBookFolders()) {
      const descriptor = readDescriptor(folder);

      for (const field of Object.keys(descriptor)) {
        assert.ok(declared.includes(field), `books/${folder}: schema has no field "${field}"`);
      }
      for (const field of schema.required) {
        assert.ok(field in descriptor, `books/${folder}: missing required "${field}"`);
      }

      const { visibility } = descriptor;
      assert.ok(
        schema.properties.visibility.enum.includes(visibility),
        `books/${folder}: visibility "${visibility}" is not in the schema's enum`,
      );
    }
  });

  test('allows the island packs the platform actually ships', () => {
    const contract = JSON.parse(readFileSync(join(ROOT, 'island-contract.json'), 'utf8'));
    const described = Object.keys(schema.properties.islands.properties.packs.properties);

    for (const pack of Object.keys(contract.packs)) {
      assert.ok(described.includes(pack), `schema does not describe the "${pack}" pack's options`);
    }
  });
});
