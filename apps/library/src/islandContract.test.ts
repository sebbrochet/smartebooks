import { describe, it, expect } from 'vitest';
import { defaultIslands } from '@smart-ebooks/engine';
import { chessIslands } from '@smart-ebooks/islands-chess';
import { mermaidIslands } from '@smart-ebooks/islands-mermaid';
import contract from '../../../island-contract.json';

/** Every island the platform can provide, from the code rather than the file. */
const allIslands = () => [...defaultIslands, ...chessIslands(), ...mermaidIslands()];

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

  it('lists exactly the mermaid pack islands', () => {
    expect([...contract.packs.mermaid].sort()).toEqual(
      mermaidIslands()
        .map((i) => i.name)
        .sort(),
    );
  });

  it('never lists the same directive twice', () => {
    const all = [...contract.builtIn, ...Object.values(contract.packs).flat()];
    expect(new Set(all).size).toBe(all.length);
  });

  // Aliases are what keep already-published books working after a rename, so a
  // missing entry here means the linter would reject content that still renders.
  it('maps every alias to its canonical island', () => {
    const fromCode = Object.fromEntries(
      [...defaultIslands, ...chessIslands()].flatMap((island) =>
        (island.aliases ?? []).map((alias) => [alias, island.name]),
      ),
    );
    expect(contract.aliases).toEqual(fromCode);
  });

  it('never aliases a name that is itself an island', () => {
    const canonical = new Set([...contract.builtIn, ...Object.values(contract.packs).flat()]);
    for (const alias of Object.keys(contract.aliases)) {
      expect(canonical.has(alias)).toBe(false);
    }
  });

  // The linter validates content against these, so a drifted schema means
  // either false errors or attributes silently going unchecked.
  it('describes the same attributes the islands declare', () => {
    // `default` is deliberately excluded: chess defaults come from each book's
    // pack options, so they are not a property of the shared contract. `min`
    // and `max` are included — the linter checks ranges, so a contract that
    // dropped them would let an out-of-range value through unreported.
    const shape = (specs: Record<string, Record<string, unknown>>) =>
      Object.fromEntries(
        Object.entries(specs).map(([name, spec]) => [
          name,
          {
            type: spec.type,
            ...(spec.required === true ? { required: true } : {}),
            ...(spec.values ? { values: [...(spec.values as string[])] } : {}),
            ...(spec.min !== undefined ? { min: spec.min } : {}),
            ...(spec.max !== undefined ? { max: spec.max } : {}),
          },
        ]),
      );

    const fromCode = Object.fromEntries(
      allIslands()
        .filter((island) => island.attributes)
        .map((island) => [
          island.name,
          shape(island.attributes as Record<string, Record<string, unknown>>),
        ]),
    );

    expect(contract.attributes).toEqual(fromCode);
  });
});
