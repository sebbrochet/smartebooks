import type { Unit } from '@smart-ebooks/engine';
import type { BookSpec, Problem, SectionSpec } from './check';

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
const DIRECTIVE = /:(choice|death|ending)(?![\w-])(?:\[([^\]]*)\])?(\{[^}]*\})?/g;
const TO = /\bto=["']([^"']+)["']/;

interface Found {
  name: string;
  /** The author's label, absent when the directive was written without one. */
  label?: string;
  to?: string;
}

function directivesIn(markdown: string): Found[] {
  return [...markdown.matchAll(DIRECTIVE)].map((match) => ({
    name: match[1],
    label: match[2],
    to: match[3] ? (TO.exec(match[3])?.[1] ?? undefined) : undefined,
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

/** Whether a label carries the destination as a word of its own. */
function namesTarget(label: string, to: string): boolean {
  return label.split(/[^\p{L}\p{N}]+/u).includes(to);
}

/**
 * Choices whose label already says where they go.
 *
 * `:choice[Rendez-vous au 3]{to="3"}` reads correctly while it is the choice
 * being offered, because that state renders the author's label alone. In the
 * two states a reader sees *afterwards* — the road taken and the road refused —
 * `ChoiceIsland` renders `words.choice(label, to)`, which appends the
 * navigation phrase itself: the reader gets **"Rendez-vous au 3 — rendez-vous
 * au 3"**. The label field is for the sentence, not for the number.
 *
 * A warning rather than an error because it is a judgement about prose, and
 * because the books that do this do it in every section: an error would turn a
 * whole book red for something no reader is currently blocked by.
 *
 * Kept out of `checkBook`, which is deliberately a graph checker and ignorant
 * of Markdown. This rule is about what the author wrote, so it belongs on the
 * side that reads prose.
 */
export function labelProblems(units: Unit[]): Problem[] {
  const problems: Problem[] = [];

  for (const unit of units) {
    for (const { name, label, to } of directivesIn(unit.markdown)) {
      if (name !== 'choice' || !to || !label || !namesTarget(label, to)) continue;

      problems.push({
        rule: 'choice-label-names-target',
        severity: 'warning',
        section: unit.id,
        message:
          `"${unit.id}" offers :choice[${label}]{to="${to}"}, whose label already names ${to}. ` +
          `Once the reader has left this section the pack adds the destination itself, ` +
          `so it is printed twice.`,
      });
    }
  }

  return problems;
}
