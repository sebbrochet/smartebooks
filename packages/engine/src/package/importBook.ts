import { unzipSync, strFromU8 } from 'fflate';
import { MIN_SUPPORTED_SCHEMA, SMARTBOOK_SCHEMA_VERSION, type SmartbookDescriptor } from './spec';
import { isAuthorId, isEdition } from './edition';

/** A parsed, validated `.smartbook` package. */
export interface ImportedPackage {
  descriptor: SmartbookDescriptor;
  /** Keyed by zip path, e.g. `content/01-intro.md` → Markdown. */
  content: Record<string, string>;
  /** Keyed by zip path, e.g. `assets/cover.png` → raw bytes. */
  assets: Record<string, Uint8Array>;
}

// Guards against pathological packages (zip bombs / abuse).
const MAX_FILES = 500;
const MAX_TOTAL_BYTES = 25 * 1024 * 1024; // 25 MB uncompressed

function isSafeSlug(value: unknown): value is string {
  return typeof value === 'string' && value.length <= 64 && /^[a-z0-9][a-z0-9-]*$/.test(value);
}

function validateDescriptor(value: unknown): asserts value is SmartbookDescriptor {
  const d = value as Record<string, unknown> | null;
  if (!d || typeof d !== 'object') throw new Error('Invalid smartbook.json.');

  // Accept a *range* of schemas rather than one exact version, so an older
  // package stays readable and a newer one is readable when it says it can be.
  const version = d.schemaVersion;
  if (typeof version !== 'number' || !Number.isInteger(version) || version < 1) {
    throw new Error('Package has an invalid schemaVersion.');
  }
  if (version < MIN_SUPPORTED_SCHEMA) {
    throw new Error(
      `Package is too old (schemaVersion ${version}; this reader supports ${MIN_SUPPORTED_SCHEMA} and up).`,
    );
  }
  // A newer package is fine as long as it declares it can be read by a reader
  // of our vintage; absent, assume it cannot.
  const needs = typeof d.minReaderSchema === 'number' ? d.minReaderSchema : version;
  if (needs > SMARTBOOK_SCHEMA_VERSION) {
    throw new Error(
      `Package needs a newer reader (requires schemaVersion ${needs}; this reader supports up to ${SMARTBOOK_SCHEMA_VERSION}).`,
    );
  }

  if (!isSafeSlug(d.slug)) throw new Error('Package has an invalid or missing slug.');
  if (typeof d.title !== 'string' || d.title.trim().length === 0) {
    throw new Error('Package has an invalid or missing title.');
  }

  /*
   * Both are optional here and both are checked when present (SPEC003 E1.2).
   *
   * Optional, because packages built before these fields existed are already in
   * readers' hands and refusing to open them would throw away the progress the
   * fields exist to protect. Checked, because a malformed one is worse than an
   * absent one: an `edition` that cannot be ordered makes every future update
   * an unanswerable "replace or not?", and an `authorId` that is not a domain
   * namespaces nothing while looking as though it does.
   */
  if (d.authorId != null && !isAuthorId(d.authorId)) {
    throw new Error('Package has an invalid authorId (expected a domain, e.g. "example.com").');
  }
  if (d.edition != null && !isEdition(d.edition)) {
    throw new Error(
      'Package has an invalid edition (expected an ISO date like 2026-09-04, or semver like 1.2.0).',
    );
  }

  if (d.chapters != null && !Array.isArray(d.chapters))
    throw new Error('Package has invalid chapters.');
}

/**
 * Parse and validate an **untrusted** `.smartbook` zip into a package. Enforces
 * size/count guards, rejects unsafe paths, requires a valid manifest, and keeps
 * only `content/*.md` (no code, no arbitrary files).
 */
export function parseSmartbook(bytes: Uint8Array): ImportedPackage {
  let files: Record<string, Uint8Array>;
  try {
    files = unzipSync(bytes);
  } catch {
    throw new Error('Could not read the package (not a valid zip).');
  }

  const names = Object.keys(files);
  if (names.length > MAX_FILES) throw new Error('Package has too many files.');
  let total = 0;
  for (const bytesOfFile of Object.values(files)) total += bytesOfFile.length;
  if (total > MAX_TOTAL_BYTES) throw new Error('Package is too large.');
  for (const name of names) {
    if (name.includes('..') || name.startsWith('/'))
      throw new Error('Package contains an unsafe path.');
  }

  const manifestBytes = files['smartbook.json'];
  if (!manifestBytes) throw new Error('Package is missing smartbook.json.');
  let descriptor: unknown;
  try {
    descriptor = JSON.parse(strFromU8(manifestBytes));
  } catch {
    throw new Error('Package has an invalid smartbook.json.');
  }
  validateDescriptor(descriptor);

  const content: Record<string, string> = {};
  const assets: Record<string, Uint8Array> = {};
  for (const [name, fileBytes] of Object.entries(files)) {
    if (name.startsWith('content/') && name.endsWith('.md')) {
      content[name] = strFromU8(fileBytes);
    } else if (name.startsWith('assets/') && !name.endsWith('/')) {
      assets[name] = fileBytes;
    }
    // Anything else (code, unknown files) is intentionally ignored.
  }
  if (Object.keys(content).length === 0) throw new Error('Package has no chapters.');

  return { descriptor, content, assets };
}
