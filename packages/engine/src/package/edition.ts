/**
 * Author identity and edition ordering (SPEC003 E1.2).
 *
 * The point of both fields is the same question: **is this package the same
 * book as one I already have, and if so, is it newer?** Import identity was
 * corrected once already (`bd01cd5`, keying on the declared slug rather than a
 * hash of the bytes), which fixed "a corrected edition orphans your progress"
 * but left two holes: two authors publishing `study-guide` are one book to a
 * reader, and nothing can tell an update from a downgrade.
 */

/**
 * A publisher id: a domain, or reverse-DNS, e.g. `sebbrochet.com`.
 *
 * **Not `authors`.** That field is optional free text meant for a byline —
 * "Seb Brochet" and "S. Brochet" are the same person to a reader and different
 * strings to a computer. Identity needs something a machine can compare, so it
 * is a separate field with a shape.
 *
 * At least two labels, so a bare word cannot pass: `guide` as an author id
 * would namespace nothing and would look deliberate in a descriptor.
 *
 * **Checked label by label rather than with one expression.** The obvious
 * pattern — `^label(\.label)+$` with `label` carrying its own quantifiers —
 * makes `security/detect-unsafe-regex` complain, and rightly: this runs against
 * a descriptor from a file a stranger sent the reader. One quantifier plus two
 * explicit hyphen rules is linear, and says what it means.
 */
const LABEL_CHARS = /^[a-z0-9-]+$/;

function isLabel(label: string): boolean {
  return LABEL_CHARS.test(label) && !label.startsWith('-') && !label.endsWith('-');
}

export function isAuthorId(value: unknown): value is string {
  if (typeof value !== 'string' || value.length === 0 || value.length > 253) return false;

  const labels = value.split('.');
  return labels.length >= 2 && labels.every(isLabel);
}

/** `YYYY-MM-DD`, checked for being a real date rather than merely digit-shaped. */
const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** `MAJOR.MINOR.PATCH`, without pre-release or build metadata. */
const SEMVER = /^(\d+)\.(\d+)\.(\d+)$/;

export type EditionKind = 'date' | 'semver';

export interface Edition {
  kind: EditionKind;
  parts: [number, number, number];
}

/**
 * Parse an edition, or return undefined if it is not one.
 *
 * **Deliberately only two shapes.** A free-form string cannot answer "is this
 * newer than what I have?", which turns every update into an unanswerable
 * "replace or not?" — so anything else is rejected at the door rather than
 * stored and puzzled over later. Pre-release semver is excluded for the same
 * reason: `1.0.0-beta.2` vs `1.0.0-beta.10` is a rule nobody agrees on, and a
 * book does not need it.
 */
export function parseEdition(value: unknown): Edition | undefined {
  if (typeof value !== 'string') return undefined;

  const date = ISO_DATE.exec(value);
  if (date) {
    const [, year, month, day] = date.map(Number) as [number, number, number, number];
    // `2026-02-31` matches the pattern and is not a day. Round-tripping through
    // Date is the cheapest way to say so without a calendar table.
    const parsed = new Date(Date.UTC(year, month - 1, day));
    if (
      parsed.getUTCFullYear() !== year ||
      parsed.getUTCMonth() !== month - 1 ||
      parsed.getUTCDate() !== day
    ) {
      return undefined;
    }
    return { kind: 'date', parts: [year, month, day] };
  }

  const semver = SEMVER.exec(value);
  if (semver) {
    const [, major, minor, patch] = semver.map(Number) as [number, number, number, number];
    return { kind: 'semver', parts: [major, minor, patch] };
  }

  return undefined;
}

export function isEdition(value: unknown): boolean {
  return parseEdition(value) !== undefined;
}

/**
 * Compare two editions: negative if `a` is older, positive if newer, 0 if the
 * same, and **undefined when they cannot be compared**.
 *
 * Incomparability is a real answer, not a failure. A book that shipped
 * `2026-01-01` and then `1.2.0` has no ordering between them — treating the
 * mixture as "equal" or "newer" would quietly pick one, and picking wrongly
 * means either refusing an update or silently downgrading a reader. The caller
 * has to decide what to do about not knowing.
 */
export function compareEditions(a: unknown, b: unknown): number | undefined {
  const left = parseEdition(a);
  const right = parseEdition(b);
  if (!left || !right || left.kind !== right.kind) return undefined;

  for (let i = 0; i < 3; i += 1) {
    if (left.parts[i] !== right.parts[i]) return left.parts[i] - right.parts[i];
  }
  return 0;
}
