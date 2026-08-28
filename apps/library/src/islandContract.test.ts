import { describe, it, expect } from 'vitest';
import { defaultIslands } from '@smart-ebooks/engine';
import { chessIslands } from '@smart-ebooks/islands-chess';
import contract from '../../../island-contract.json';

/**
 * `island-contract.json` is what the content linter validates books against.
 * The linter runs in plain Node and cannot import the engine's TypeScript, so
 * the contract is a committed artefact — and these tests are what stop it
 * drifting away from the code it describes.
 */
describe('island-contract.json', () => {
  it('lists exactly the built-in islands', () => {
    expect([...contract.builtIn].sort()).toEqual(defaultIslands.map((i) => i.name).sort());
  });

  it('lists exactly the chess pack islands', () => {
    expect([...contract.packs.chess].sort()).toEqual(
      chessIslands()
        .map((i) => i.name)
        .sort(),
    );
  });

  it('never lists the same directive twice', () => {
    const all = [...contract.builtIn, ...Object.values(contract.packs).flat()];
    expect(new Set(all).size).toBe(all.length);
  });
});
