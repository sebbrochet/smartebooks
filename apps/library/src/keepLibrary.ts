/**
 * Ask the browser to keep this reader's library.
 *
 * By default an origin's IndexedDB and caches are **best-effort**: the browser
 * may reclaim them under storage pressure, and Safari clears them outright
 * after seven days without a visit unless the app is installed. For a shelf of
 * imported books that is the difference between a library and a cache — the
 * packages came from files the reader may no longer have, so eviction is data
 * loss rather than a slow reload.
 *
 * `persist()` is a **request**, not a setting. Browsers weigh their own signals
 * — Chrome grants it readily to an installed app and reluctantly to a tab —
 * and may say no. That is a reason to ask at the right moment rather than a
 * reason not to ask: not asking guarantees the weakest answer available.
 *
 * Asked on import, because that is when the reader has just added something
 * they would miss, and asking is cheap enough to repeat.
 *
 * Returns what the browser decided, for a caller that wants to say so. Never
 * throws: a reader importing a book does not need to hear about a storage API.
 */
export async function keepLibrary(): Promise<boolean> {
  try {
    if (!navigator.storage?.persist) return false;
    if (await navigator.storage.persisted?.()) return true;
    return await navigator.storage.persist();
  } catch {
    return false;
  }
}
