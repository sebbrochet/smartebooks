import type { Condition } from './condition';

/**
 * Whether a gamebook is playable, asked of its graph.
 *
 * SPEC011 K4, and the strongest argument for this domain: a gamebook *is* a
 * graph, and a graph can be checked. This is the first pack whose linter proves
 * something the runtime cannot — not "this attribute is valid" but "a reader
 * cannot get stuck, and cannot be sent somewhere they have never been".
 *
 * Pure, and deliberately ignorant of Markdown. Extracting the graph from a book
 * is a separate job that needs the content model (SPEC005 M2); the rules do
 * not, and they are the half that would be painful to retrofit (§8.3).
 */

export interface SectionSpec {
  id: string;
  /** Section ids this section offers, in the order they are written. */
  choices: string[];
  /** Terminal sections offer no choices and say why (K4.4). */
  kind?: 'ending' | 'death';
  /** Where a death sends the reader, overriding the book's default (QG11). */
  respawn?: string;
  /** Conditions this section tests, for K4.5. */
  conditions?: Condition[];
}

export interface BookSpec {
  start: string;
  /** The book-wide respawn, used by any death that does not name its own. */
  respawn?: string;
  sections: SectionSpec[];
  stats?: string[];
  items?: string[];
  flags?: string[];
}

export type Rule =
  | 'start-missing'
  | 'duplicate-id'
  | 'choice-target'
  | 'dead-end'
  | 'unreachable'
  | 'unknown-name'
  | 'respawn-missing'
  | 'respawn-unreachable';

export interface Problem {
  rule: Rule;
  severity: 'error' | 'warning';
  section?: string;
  message: string;
}

function reachableFrom(start: string, byId: Map<string, SectionSpec>): Set<string> {
  const seen = new Set<string>();
  const queue = byId.has(start) ? [start] : [];

  while (queue.length > 0) {
    const id = queue.pop() as string;
    if (seen.has(id)) continue;
    seen.add(id);
    for (const next of byId.get(id)?.choices ?? []) if (byId.has(next)) queue.push(next);
  }
  return seen;
}

/**
 * Which sections a reader must have passed through to reach each section.
 *
 * The standard iterative dominator computation: a section is dominated by
 * itself and by everything that dominates *all* of its predecessors. Run only
 * over the reachable graph, because an unreachable section has no paths for the
 * question to be about — and it is reported separately anyway.
 */
function dominators(
  start: string,
  byId: Map<string, SectionSpec>,
  reachable: Set<string>,
): Map<string, Set<string>> {
  const preds = new Map<string, string[]>();
  for (const id of reachable) {
    for (const next of byId.get(id)?.choices ?? []) {
      if (reachable.has(next)) preds.set(next, [...(preds.get(next) ?? []), id]);
    }
  }

  const dom = new Map<string, Set<string>>();
  for (const id of reachable) dom.set(id, new Set(id === start ? [start] : reachable));

  let settled = false;
  while (!settled) {
    settled = true;
    for (const id of reachable) {
      if (id === start) continue;

      const incoming = preds.get(id) ?? [];
      const shared =
        incoming.length === 0
          ? new Set<string>()
          : incoming
              .map((from) => dom.get(from) as Set<string>)
              .reduce((a, b) => new Set([...a].filter((each) => b.has(each))));

      const next = new Set([id, ...shared]);
      const current = dom.get(id) as Set<string>;
      if (next.size !== current.size || [...next].some((each) => !current.has(each))) {
        dom.set(id, next);
        settled = false;
      }
    }
  }
  return dom;
}

function namesIn(condition: Condition): { pool: 'items' | 'flags' | 'stats'; name: string } {
  switch (condition.kind) {
    case 'item':
      return { pool: 'items', name: condition.item };
    case 'flag':
      return { pool: 'flags', name: condition.flag };
    case 'stat':
      return { pool: 'stats', name: condition.stat };
  }
}

/** Every problem in the book, errors and warnings together, in reading order. */
export function checkBook(book: BookSpec): Problem[] {
  const problems: Problem[] = [];
  const byId = new Map<string, SectionSpec>();

  for (const section of book.sections) {
    if (byId.has(section.id)) {
      problems.push({
        rule: 'duplicate-id',
        severity: 'error',
        section: section.id,
        message: `section "${section.id}" is defined more than once`,
      });
      continue;
    }
    byId.set(section.id, section);
  }

  if (!byId.has(book.start)) {
    problems.push({
      rule: 'start-missing',
      severity: 'error',
      message: `the book starts at "${book.start}", which does not exist`,
    });
  }

  const reachable = reachableFrom(book.start, byId);
  const dom = dominators(book.start, byId, reachable);
  const declared = { items: book.items ?? [], flags: book.flags ?? [], stats: book.stats ?? [] };

  for (const section of byId.values()) {
    // K4.1. The worst bug this domain has, and statically detectable.
    for (const to of section.choices) {
      if (!byId.has(to)) {
        problems.push({
          rule: 'choice-target',
          severity: 'error',
          section: section.id,
          message: `"${section.id}" offers a choice to "${to}", which does not exist`,
        });
      }
    }

    // K4.4. The other classic: a section a reader can enter and never leave.
    if (section.choices.length === 0 && !section.kind) {
      problems.push({
        rule: 'dead-end',
        severity: 'error',
        section: section.id,
        message: `"${section.id}" offers no choice and is not marked an ending or a death`,
      });
    }

    // K4.3, a warning by QG5: an author may be mid-draft, and an unreachable
    // section can be a deliberate easter egg the linter cannot see.
    if (!reachable.has(section.id)) {
      problems.push({
        rule: 'unreachable',
        severity: 'warning',
        section: section.id,
        message: `"${section.id}" cannot be reached from "${book.start}"`,
      });
    }

    // K4.5, the `:move` label lesson (SPEC008 C14) applied before it bites.
    for (const condition of section.conditions ?? []) {
      const { pool, name } = namesIn(condition);
      if (!declared[pool].includes(name)) {
        problems.push({
          rule: 'unknown-name',
          severity: 'error',
          section: section.id,
          message: `"${section.id}" tests ${pool.slice(0, -1)} "${name}", which the book does not declare`,
        });
      }
    }

    // K4.6. Proving QG13 away rather than guessing at runtime.
    if (section.kind !== 'death') continue;
    const respawn = section.respawn ?? book.respawn;

    if (!respawn || !byId.has(respawn)) {
      problems.push({
        rule: 'respawn-missing',
        severity: 'error',
        section: section.id,
        message: respawn
          ? `"${section.id}" respawns at "${respawn}", which does not exist`
          : `"${section.id}" is a death and neither it nor the book names a respawn`,
      });
    } else if (reachable.has(section.id) && !dom.get(section.id)?.has(respawn)) {
      problems.push({
        rule: 'respawn-unreachable',
        severity: 'error',
        section: section.id,
        message: `"${section.id}" respawns at "${respawn}", but a reader can reach "${section.id}" without passing through it`,
      });
    }
  }

  return problems;
}
