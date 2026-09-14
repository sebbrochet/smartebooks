/**
 * Lets these scripts import the engine's own TypeScript.
 *
 * Node can strip types from a `.ts` file, but it will not guess at a missing
 * extension, and the engine's sources import each other the way a bundler
 * expects — `./extract`, not `./extract.ts`. This adds the extension only after
 * normal resolution has already failed, so nothing that resolves today changes
 * meaning, and a genuinely missing module still reports itself as missing.
 *
 * The point is to stop *re-implementing* rules in `.mjs`. A second copy of a
 * rule agrees with the first about the obvious case and drifts on the edges,
 * which is exactly where a linter earns its keep.
 */
export async function resolve(specifier, context, nextResolve) {
  try {
    return await nextResolve(specifier, context);
  } catch (error) {
    if (error?.code !== 'ERR_MODULE_NOT_FOUND' || !specifier.startsWith('.')) throw error;
    return nextResolve(`${specifier}.ts`, context);
  }
}
