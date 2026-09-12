import { describe, it, expect } from 'vitest';
import {
  apply,
  begin,
  canRead,
  current,
  emptySheet,
  go,
  isLive,
  respawn,
  sheetNow,
  tookFrom,
} from './journey';

const T = 1_000; // every test passes its own time, so nothing here reads a clock

const start = () => begin('1', { stats: { stamina: 12 }, items: [], flags: [] }, T);

describe('the journey', () => {
  it('starts with one section accessible and no other', () => {
    const play = start();
    expect(canRead(play, '1')).toBe(true);
    expect(canRead(play, '45')).toBe(false);
  });

  // §4 rule 5. The whole guided model is this line: a section offered and
  // refused never becomes readable, so there is nothing to scroll into.
  it('never opens a section that was offered and not taken', () => {
    const play = go(start(), '45', T);
    expect(canRead(play, '45')).toBe(true);
    expect(canRead(play, '112')).toBe(false);
  });

  // §4.2a. Gamebooks loop: the same room twice, with different gold and a
  // different wound. De-duplicating would make the journey lie.
  it('records a second visit to the same section as a second entry', () => {
    const play = go(go(go(start(), '42', T), '7', T), '42', T);

    expect(play.visits.map((visit) => visit.section)).toEqual(['1', '42', '7', '42']);
    expect(new Set(play.visits.map((visit) => visit.id)).size).toBe(4);
  });

  it('names the choice taken out of a visit by reading the next one', () => {
    const play = go(go(start(), '45', T), '112', T);

    expect(tookFrom(play.visits, 0)).toBe('45');
    expect(tookFrom(play.visits, 1)).toBe('112');
    // The reader is standing in 112 and has not chosen yet.
    expect(tookFrom(play.visits, 2)).toBeUndefined();
  });

  it('treats only the last entry as live, so a past section cannot act', () => {
    const play = go(start(), '45', T);

    expect(isLive(play, play.visits[0].id)).toBe(false);
    expect(isLive(play, play.visits[1].id)).toBe(true);
  });
});

describe('effects', () => {
  const door = { kind: 'stat', stat: 'stamina', by: -2 } as const;

  // K2.7, and the bug this model would otherwise ship with: a reader flipping
  // back to re-read section 42 must not be charged for the door again.
  it('charges a visit once, however many times the island asks', () => {
    let play = go(start(), '42', T);
    play = apply(play, 'door', door);
    play = apply(play, 'door', door);
    play = apply(play, 'door', door);

    expect(sheetNow(play).stats.stamina).toBe(10);
  });

  // The other half of the same rule, and the reason it is keyed by visit and
  // not by section: walking through the same door a second time is a second
  // trip, and it costs again.
  it('charges again on a genuinely new visit to the same section', () => {
    let play = apply(go(start(), '42', T), 'door', door);
    play = apply(go(go(play, '7', T), '42', T), 'door', door);

    expect(sheetNow(play).stats.stamina).toBe(8);
    expect(play.visits.filter((visit) => visit.section === '42')).toHaveLength(2);
  });

  it('leaves earlier entries holding the sheet as it was then', () => {
    let play = apply(go(start(), '42', T), 'door', door);
    play = apply(go(play, '7', T), 'potion', { kind: 'stat', stat: 'stamina', by: 4 });

    expect(play.visits[0].sheet.stats.stamina).toBe(12);
    expect(play.visits[1].sheet.stats.stamina).toBe(10);
    expect(play.visits[2].sheet.stats.stamina).toBe(14);
  });

  it('carries items and flags forward, and takes them away again', () => {
    let play = apply(start(), 'key', { kind: 'item', item: 'silver key', gain: true });
    play = apply(go(play, '88', T), 'flag', { kind: 'flag', flag: 'met the witch', set: true });

    expect(sheetNow(play).items).toEqual(['silver key']);
    expect(sheetNow(play).flags).toEqual(['met the witch']);

    play = apply(play, 'spend', { kind: 'item', item: 'silver key', gain: false });
    expect(sheetNow(play).items).toEqual([]);
  });

  it('does not stack an item the reader already holds', () => {
    let play = apply(start(), 'key', { kind: 'item', item: 'rope', gain: true });
    play = apply(go(play, '9', T), 'rope-again', { kind: 'item', item: 'rope', gain: true });

    expect(sheetNow(play).items).toEqual(['rope']);
  });

  it('never edits an entry the reader has left', () => {
    const play = apply(go(start(), '42', T), 'door', door);
    const before = play.visits[0];

    expect(apply(play, 'door', door).visits[0]).toBe(before);
    expect(before.applied).toEqual([]);
  });
});

describe('respawn', () => {
  // QG9. The failed branch is kept, closed: the reader can read their own
  // death, which is half of why anyone rereads these books.
  it('truncates to the respawn point and keeps the branch readable', () => {
    let play = go(go(go(start(), '42', T), '7', T), '99', T);
    play = respawn(play, '42', T);

    expect(play.visits.map((visit) => visit.section)).toEqual(['1', '42']);
    expect(play.closed[0].visits.map((visit) => visit.section)).toEqual(['7', '99']);

    expect(canRead(play, '99')).toBe(true); // readable
    expect(current(play).section).toBe('42'); // but not where the reader is
  });

  // QG10's default, and what the per-entry snapshot is for: rolling the sheet
  // back is a slice, not a replay.
  it('rolls the sheet back to how it stood at the respawn point', () => {
    let play = apply(go(start(), '42', T), 'door', { kind: 'stat', stat: 'stamina', by: -2 });
    play = apply(go(play, '99', T), 'trap', { kind: 'stat', stat: 'stamina', by: -9 });
    expect(sheetNow(play).stats.stamina).toBe(1);

    play = respawn(play, '42', T);
    expect(sheetNow(play).stats.stamina).toBe(10);
  });

  // Effects are keyed by visit id, so a reused id would let a closed attempt's
  // spending look already-applied in the new one.
  it('does not reuse the id of a visit sitting in a closed attempt', () => {
    let play = go(go(start(), '42', T), '99', T);
    const closedIds = play.visits.map((visit) => visit.id);

    play = respawn(play, '1', T);
    play = go(play, '7', T);

    expect(closedIds).toContain('v2');
    expect(play.visits.map((visit) => visit.id)).not.toContain('v2');
  });

  it('lets the reader walk the same road again after dying on it', () => {
    let play = respawn(go(go(start(), '42', T), '99', T), '42', T);
    play = go(play, '99', T);

    expect(play.visits.map((visit) => visit.section)).toEqual(['1', '42', '99']);
    expect(current(play).applied).toEqual([]); // a fresh trip, charged afresh
  });

  // QG13: an author can avoid this, and the linter should make them. At
  // runtime the reader must still land somewhere.
  it('closes the whole journey when sent somewhere never visited', () => {
    const play = respawn(go(start(), '42', T), '500', T);

    expect(play.visits.map((visit) => visit.section)).toEqual(['500']);
    expect(play.closed[0].visits.map((visit) => visit.section)).toEqual(['1', '42']);
    expect(sheetNow(play).stats.stamina).toBe(12); // nothing to roll back to
  });

  it('does not open a closed attempt when nothing was truncated', () => {
    const play = respawn(go(start(), '42', T), '42', T);
    expect(play.closed).toEqual([]);
  });
});

describe('the record', () => {
  it('survives a round trip through the store as plain JSON', () => {
    let play = apply(go(start(), '42', T), 'door', { kind: 'stat', stat: 'stamina', by: -2 });
    play = respawn(go(play, '99', T), '42', T);

    expect(JSON.parse(JSON.stringify(play))).toEqual(play);
  });

  it('never edits the playthrough it was given', () => {
    const play = start();
    const copy = JSON.parse(JSON.stringify(play));

    go(play, '42', T);
    apply(play, 'door', { kind: 'stat', stat: 'stamina', by: -2 });
    respawn(play, '1', T);

    expect(play).toEqual(copy);
  });

  it('has a fresh sheet each time, not one shared object', () => {
    const sheet = emptySheet();
    sheet.stats.stamina = 1;
    expect(emptySheet().stats).toEqual({});
  });
});
