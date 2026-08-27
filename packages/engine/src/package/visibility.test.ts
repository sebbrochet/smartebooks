import { describe, it, expect } from 'vitest';
import { isPublic } from './spec';

describe('isPublic', () => {
  it('publishes only when a book explicitly says so', () => {
    expect(isPublic({ visibility: 'public' })).toBe(true);
  });

  it('keeps a book private when it says so', () => {
    expect(isPublic({ visibility: 'private' })).toBe(false);
  });

  // The default has to fall the safe way: a book that never made a decision is
  // not published (SPEC003 E1.1).
  it('treats an absent visibility as private', () => {
    expect(isPublic({})).toBe(false);
    expect(isPublic({ visibility: undefined })).toBe(false);
  });

  // Deliberately not `!== 'private'`: a typo or a stray value from a
  // hand-edited descriptor must not publish anything.
  it('treats an unrecognised visibility as private', () => {
    expect(isPublic({ visibility: 'Public' as never })).toBe(false);
    expect(isPublic({ visibility: 'publik' as never })).toBe(false);
    expect(isPublic({ visibility: '' as never })).toBe(false);
    expect(isPublic({ visibility: true as never })).toBe(false);
  });
});
