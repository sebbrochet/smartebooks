import type { Unit } from '@smart-ebooks/engine';
import type { BookSpec, SectionSpec } from './check';

/**
 * A book's choice graph, read out of its units (SPEC011 K4).
 *
 * `check.ts` has been able to prove a book playable since the day it was
 * written and has never been given a book, because nothing turned prose into a
 * graph. This is that missing half.
 *
 * **Read with one regular expression, not with a parser**, which is a
 * deliberate trade: the engine's directive parsing lives behind `remark`, and
 * pulling a Markdown pipeline into a linter to find `to="45"` costs more than
 * it settles. The risk is a directive form these patterns miss, so the tests
 * are weighted at the awkward spellings — a label, single quotes, several on
 * one line — rather than at the tidy case.
 *
 * The directive and its attributes are matched **separately**. Doing it in one
 * pattern needs `[^}]*` on both sides of the attribute, which is the nested
 * shape `security/detect-unsafe-regex` objects to — and it is right to, since
 * the input is authored text and an imported book can carry anything.
 */
/*
 * `safe-regex` counts star height and this is two — a `*` inside an optional
 * group, twice. It is the rule's known over-report: each star is bounded by its
 * own delimiter class (`[^\]]` before `]`, `[^}]` before `}`), so there is no
 * ambiguity for the engine to backtrack over and the match is linear. The pair
 * that would have been a real risk — `[^}]*` on *both* sides of the attribute —
 * is why the attributes are read separately below.
 */
// eslint-disable-next-line security/detect-unsafe-regex
const DIRECTIVE = /:(choice|death|ending)(?![\w-])(?:\[[^\]]*\])?(\{[^}]*\})?/g;
const TO = /\bto=["']([^"']+)["']/;

interface Found {
  name: string;
  to?: string;
}

function directivesIn(markdown: string): Found[] {
  return [...markdown.matchAll(DIRECTIVE)].map((match) => ({
    name: match[1],
    to: match[2] ? (TO.exec(match[2])?.[1] ?? undefined) : undefined,
  }));
}

/** One section, as the linter needs to see it. */
export function sectionOf(unit: Unit): SectionSpec {
  const found = directivesIn(unit.markdown);

  const death = found.find((directive) => directive.name === 'death' && directive.to);
  if (death?.to) return { id: unit.id, choices: [], kind: 'death', respawn: death.to };

  const choices = found
    .filter((directive) => directive.name === 'choice' && directive.to)
    .map((directive) => directive.to as string);

  const ending = found.some((directive) => directive.name === 'ending');

  return { id: unit.id, choices, ...(ending && choices.length === 0 ? { kind: 'ending' } : {}) };
}

/**
 * The whole book as a graph. The first unit is the start, which is the same
 * rule the gate uses before a reader has chosen anything (§4 rule 1).
 */
export function graphOf(units: Unit[]): BookSpec {
  return { start: units[0]?.id ?? '', sections: units.map(sectionOf) };
}
