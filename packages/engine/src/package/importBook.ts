import { unzipSync, strFromU8 } from 'fflate';
import { SMARTBOOK_SCHEMA_VERSION, type SmartbookDescriptor } from './spec';

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
  if (d.schemaVersion !== SMARTBOOK_SCHEMA_VERSION) {
    throw new Error(
      `Unsupported package version (expected schemaVersion ${SMARTBOOK_SCHEMA_VERSION}).`,
    );
  }
  if (!isSafeSlug(d.slug)) throw new Error('Package has an invalid or missing slug.');
  if (typeof d.title !== 'string' || d.title.trim().length === 0) {
    throw new Error('Package has an invalid or missing title.');
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
