import type { Sheet } from './journey';

/**
 * What `:::if` may ask, and how it reads when nobody can run it.
 *
 * SPEC011 QG4, and the vocabulary falls out of the fallback rather than the
 * other way round. A printed gamebook types *"If you have the silver key, turn
 * to 45"*, so the static form has to render the **condition itself** in prose —
 * and a condition that must be expressible in words cannot be an expression
 * language (§5.7). Three shapes is what survives that requirement.
 *
 * English literals, like every other island's chrome (SPEC001 L18). Translation
 * is P2.8's job and should not be invented here.
 */
export type Condition =
  | { kind: 'item'; item: string }
  | { kind: 'flag'; flag: string }
  | { kind: 'stat'; stat: string; bound: 'atLeast' | 'atMost'; value: number };

/**
 * Whether the sheet satisfies the condition.
 *
 * A stat the book never declared reads as zero rather than throwing: the
 * runtime is forgiving and the linter is strict (K4.5), so an author's typo
 * costs them a lint error and costs the reader nothing.
 */
export function holds(sheet: Sheet, condition: Condition): boolean {
  switch (condition.kind) {
    case 'item':
      return sheet.items.includes(condition.item);
    case 'flag':
      return sheet.flags.includes(condition.flag);
    case 'stat': {
      const held = sheet.stats[condition.stat] ?? 0;
      return condition.bound === 'atLeast' ? held >= condition.value : held <= condition.value;
    }
  }
}

/**
 * The condition as a clause, for the fallback: *"If **you have the silver
 * key**, turn to 45."*
 *
 * Two conventions the shapes are built around, both taken from how these books
 * are actually typeset:
 *
 * - **A flag is written as a past participle** — `flag="freed the prisoner"` —
 *   so that it negates without conjugating anything: *you have freed* / *you
 *   have not freed*. This is the only reason flags read at all; an imperative
 *   or a noun would need a verb table.
 * - **A stat prints in capitals** (*your STAMINA*), matching `:stat[…]` in §5.5.
 */
export function conditionProse(condition: Condition, negated = false): string {
  switch (condition.kind) {
    case 'item':
      return negated ? `you do not have the ${condition.item}` : `you have the ${condition.item}`;
    case 'flag':
      return negated ? `you have not ${condition.flag}` : `you have ${condition.flag}`;
    case 'stat': {
      const stat = `your ${condition.stat.toUpperCase()}`;
      if (condition.bound === 'atLeast') {
        return negated
          ? `${stat} is less than ${condition.value}`
          : `${stat} is ${condition.value} or more`;
      }
      return negated
        ? `${stat} is more than ${condition.value}`
        : `${stat} is ${condition.value} or less`;
    }
  }
}
