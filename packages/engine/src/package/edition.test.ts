import { describe, it, expect } from 'vitest';
import { isAuthorId, isEdition, parseEdition, compareEditions } from './edition';

describe('authorId', () => {
  it.each(['example.com', 'sebbrochet.com', 'books.example.co.uk', 'a-b.c-d.org', 'x1.y2'])(
    'accepts %s',
    (value) => expect(isAuthorId(value)).toBe(true),
  );

  /**
   * A bare word namespaces nothing while looking deliberate in a descriptor,
   * which is the failure this shape exists to prevent — so at least two labels.
   */
  it.each(['guide', 'Example.com', 'example..com', '-example.com', 'example.com-', '.com', ''])(
    'rejects %s',
    (value) => expect(isAuthorId(value)).toBe(false),
  );

  it('rejects things that are not strings', () => {
    expect(isAuthorId(undefined)).toBe(false);
    expect(isAuthorId(42)).toBe(false);
    expect(isAuthorId({ toString: () => 'example.com' })).toBe(false);
  });
});

describe('edition', () => {
  it.each(['2026-09-04', '1999-01-01', '2024-02-29', '1.2.0', '0.0.1', '10.20.30'])(
    'accepts %s',
    (value) => expect(isEdition(value)).toBe(true),
  );

  /** Digit-shaped is not the same as a date. */
  it.each(['2026-02-31', '2026-13-01', '2026-00-10', '2025-02-29'])('rejects %s', (value) =>
    expect(isEdition(value)).toBe(false),
  );

  /**
   * Pre-release semver is excluded deliberately: `1.0.0-beta.2` versus
   * `1.0.0-beta.10` is a rule nobody agrees on, and a book does not need it.
   */
  it.each(['1.2', 'v1.2.0', '1.2.0-beta.1', '1.2.0+build', 'second edition', 'latest', ''])(
    'rejects %s',
    (value) => expect(isEdition(value)).toBe(false),
  );

  it('records which of the two shapes it read', () => {
    expect(parseEdition('2026-09-04')?.kind).toBe('date');
    expect(parseEdition('1.2.0')?.kind).toBe('semver');
  });
});

describe('compareEditions', () => {
  it('orders dates', () => {
    expect(compareEditions('2026-09-04', '2026-09-05')).toBeLessThan(0);
    expect(compareEditions('2026-10-01', '2026-09-30')).toBeGreaterThan(0);
    expect(compareEditions('2026-09-04', '2026-09-04')).toBe(0);
  });

  it('orders semver by component, not as a string', () => {
    // The bug this prevents: "10" sorts before "9" alphabetically.
    expect(compareEditions('1.9.0', '1.10.0')).toBeLessThan(0);
    expect(compareEditions('2.0.0', '1.99.99')).toBeGreaterThan(0);
    expect(compareEditions('1.2.3', '1.2.3')).toBe(0);
  });

  /**
   * Incomparability is a real answer, not a failure. A book that shipped
   * `2026-01-01` and then `1.2.0` has no ordering between the two; guessing
   * would mean either refusing a genuine update or silently downgrading a
   * reader, and the caller has to decide what to do about not knowing.
   */
  it('refuses to compare a date with a semver', () => {
    expect(compareEditions('2026-01-01', '1.2.0')).toBeUndefined();
    expect(compareEditions('1.2.0', '2026-01-01')).toBeUndefined();
  });

  it('refuses to compare anything unparseable, including nothing at all', () => {
    expect(compareEditions('1.2.0', 'second edition')).toBeUndefined();
    expect(compareEditions(undefined, '1.2.0')).toBeUndefined();
    expect(compareEditions('1.2.0', undefined)).toBeUndefined();
    expect(compareEditions(undefined, undefined)).toBeUndefined();
  });
});
