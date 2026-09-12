/**
 * A gamebook playthrough: the journey, and the rules that keep it honest.
 *
 * SPEC011 §4. The reader begins with one section accessible and earns the rest
 * by choosing. The journey is the record of what they chose — and it is also
 * the book's table of contents (§4.1), which is why it is browsable data rather
 * than a cursor: a gamebook's contents list is the reader's own history, one
 * entry long at the start.
 *
 * Pure and JSON-serialisable throughout. One playthrough is one store record
 * (K2.1), so every function here returns a new playthrough rather than editing
 * one, and a write stays atomic even when a section changes three stats at once.
 */

/** Stats, items and flags, in whatever names the book declares. */
export interface Sheet {
  stats: Record<string, number>;
  items: string[];
  flags: string[];
}

/** A single change to the sheet. Deliberately not an expression language (§5.7). */
export type Effect =
  | { kind: 'stat'; stat: string; by: number }
  | { kind: 'item'; item: string; gain: boolean }
  | { kind: 'flag'; flag: string; set: boolean };

export interface Visit {
  /** Unique across the whole playthrough, including closed attempts. */
  id: string;
  section: string;
  at: number;
  /**
   * Ids of the effects this visit has already applied.
   *
   * **Held inside the visit, which is what makes K2.7 structural rather than a
   * rule to remember**: there is no way to key an effect by section, because
   * the only record of one existing is per visit. A reader re-reading section
   * 42 is re-reading a *visit* that has already spent its effects, so the door
   * cannot charge them twice (§4.2c).
   */
  applied: string[];
  /** The sheet as it stood after this visit (K2.6). */
  sheet: Sheet;
}

/** A branch the reader did not survive: readable, and impossible to continue (QG9). */
export interface ClosedAttempt {
  visits: Visit[];
  at: number;
}

export interface Playthrough {
  /** The live journey, oldest first. Only the last entry is live. */
  visits: Visit[];
  closed: ClosedAttempt[];
  /**
   * Next visit number, monotonic across the whole playthrough.
   *
   * Never reset by a respawn: a new visit must not take the id of one sitting
   * in a closed attempt, or the journey would have two entries answering to the
   * same name and any link into it would be ambiguous.
   */
  nextVisit: number;
}

export function emptySheet(): Sheet {
  return { stats: {}, items: [], flags: [] };
}

function withEffect(sheet: Sheet, effect: Effect): Sheet {
  switch (effect.kind) {
    case 'stat':
      return {
        ...sheet,
        stats: { ...sheet.stats, [effect.stat]: (sheet.stats[effect.stat] ?? 0) + effect.by },
      };
    case 'item':
      return {
        ...sheet,
        items: effect.gain
          ? sheet.items.includes(effect.item)
            ? sheet.items
            : [...sheet.items, effect.item]
          : sheet.items.filter((held) => held !== effect.item),
      };
    case 'flag':
      return {
        ...sheet,
        flags: effect.set
          ? sheet.flags.includes(effect.flag)
            ? sheet.flags
            : [...sheet.flags, effect.flag]
          : sheet.flags.filter((held) => held !== effect.flag),
      };
  }
}

function visitAt(id: number, section: string, at: number, sheet: Sheet): Visit {
  return { id: `v${id}`, section, at, applied: [], sheet };
}

/** A new playthrough, standing in its first section with a fresh sheet. */
export function begin(section: string, sheet: Sheet = emptySheet(), at = Date.now()): Playthrough {
  return { visits: [visitAt(1, section, at, sheet)], closed: [], nextVisit: 2 };
}

/** Where the reader is now. The journey always has at least one entry. */
export function current(play: Playthrough): Visit {
  return play.visits[play.visits.length - 1];
}

/** The sheet as it stands, which is the last entry's snapshot (K2.6). */
export function sheetNow(play: Playthrough): Sheet {
  return current(play).sheet;
}

/**
 * Takes a choice: appends a visit to `section`, carrying the sheet forward.
 *
 * **A visit, not a section** (§4.2a). Gamebooks loop — the same room is reached
 * twice by different routes, with different gold and a different wound — so
 * arriving at 42 a second time appends a second entry. De-duplicating would
 * make the journey lie about the story it exists to record.
 */
export function go(play: Playthrough, section: string, at = Date.now()): Playthrough {
  return {
    ...play,
    visits: [...play.visits, visitAt(play.nextVisit, section, at, sheetNow(play))],
    nextVisit: play.nextVisit + 1,
  };
}

/**
 * Applies an effect once, to the live visit only.
 *
 * `effectId` identifies the island in its section, so the same `::stat-add`
 * asked twice within one visit — a re-render, a reload, a reader scrolling back
 * up the page — costs the reader once. A genuinely new visit to the same
 * section has its own empty `applied` list and is charged again, which is
 * correct: it is a different trip through the same door.
 *
 * Past visits are inert (§4 rule 4), and this is where that is enforced: there
 * is no parameter that could name one.
 */
export function apply(play: Playthrough, effectId: string, effect: Effect): Playthrough {
  const live = current(play);
  if (live.applied.includes(effectId)) return play;

  const updated: Visit = {
    ...live,
    applied: [...live.applied, effectId],
    sheet: withEffect(live.sheet, effect),
  };
  return { ...play, visits: [...play.visits.slice(0, -1), updated] };
}

/**
 * The delivery gate (SPEC002 R1.1a) as this domain answers it: a section may be
 * read if the reader has been there.
 *
 * Closed attempts count. The reader may re-read their own death (QG9); they
 * simply cannot continue from it. Sections that were offered and refused never
 * become readable (§4 rule 5), which is the whole model in one line.
 */
export function canRead(play: Playthrough, section: string): boolean {
  return (
    play.visits.some((visit) => visit.section === section) ||
    play.closed.some((attempt) => attempt.visits.some((visit) => visit.section === section))
  );
}

/** Whether this visit is the one the reader is on — the only one that may act (§4.2b). */
export function isLive(play: Playthrough, visitId: string): boolean {
  return current(play).id === visitId;
}

/**
 * The section taken out of the visit at `index`, or undefined if the reader is
 * still standing there.
 *
 * **Derived rather than stored.** K2.5 lists "the choice taken out of it" as a
 * field of the entry, but the next entry already says where the reader went, so
 * storing it would be a second source of truth for one fact — the shape this
 * repository keeps rediscovering (SPEC008 C16, C25). Deriving is also the more
 * correct answer after a respawn: the tail moves to a closed attempt, and the
 * reader standing at the truncation point genuinely has not chosen yet.
 */
export function tookFrom(visits: Visit[], index: number): string | undefined {
  return visits[index + 1]?.section;
}

/**
 * Death: truncate the live journey back to `section` and keep what came after
 * as a closed attempt (QG9).
 *
 * The sheet rolls back for free, because each entry carries its own snapshot
 * (K2.6) — this is the whole reason snapshots are worth their tens of
 * kilobytes. QG10 leaves "carry the losses instead" to the book; that belongs
 * with the book's declaration and is not yet a parameter here.
 *
 * If the reader has never been to the respawn section, there is nothing to
 * truncate *to*: the entire journey closes and a new one opens there, carrying
 * the sheet forward because there is no snapshot to roll back to. An author can
 * avoid this entirely and the linter should say so — see QG13.
 */
export function respawn(play: Playthrough, section: string, at = Date.now()): Playthrough {
  const mark = play.visits.map((visit) => visit.section).lastIndexOf(section);

  if (mark === -1) {
    return {
      visits: [visitAt(play.nextVisit, section, at, sheetNow(play))],
      closed: [...play.closed, { visits: play.visits, at }],
      nextVisit: play.nextVisit + 1,
    };
  }

  const tail = play.visits.slice(mark + 1);
  return {
    visits: play.visits.slice(0, mark + 1),
    closed: tail.length > 0 ? [...play.closed, { visits: tail, at }] : play.closed,
    nextVisit: play.nextVisit,
  };
}
