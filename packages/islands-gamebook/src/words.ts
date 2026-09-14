import { type ReactNode } from 'react';

/**
 * What the pack says out loud, in the book's own language (SPEC010 M1).
 *
 * A gamebook's controls are *prose*. `turn to 45` is not chrome around the
 * story, it is the printed book's own line, and a French one says
 * « rendez-vous au 45 ». So an English default in a French book is not a
 * neutral placeholder the reader forgives — it is the wrong book, in the middle
 * of a sentence the author wrote.
 *
 * **Whole sentences, not fragments.** `sectionsRead` builds its clause rather
 * than exposing the pieces, because stitching "You have read" + a number + a
 * noun is the classic way a translation comes out as nonsense: word order and
 * the plural rule are not the same in the two languages here, let alone the
 * next one.
 *
 * Several of these are unreachable by an author — the note on a road already
 * taken, the labels in the journey record — which is why this exists at all. A
 * label an author can write is a label they can translate themselves.
 */
export interface Words {
  /** The whole rendered choice, with the author's label when there is one. */
  choice: (label: string, to: string) => string;
  /** The link's own text when the author wrote no label. */
  turnTo: (to: string) => string;
  wentThisWay: string;
  notTaken: string;
  returnTo: (to: string) => string;
  beginAgain: string;
  storyEnds: ReactNode;
  journeys: string;
  thisOne: string;
  theOneBefore: string;
  earlier: string;
  sectionsRead: (count: number, unseen: string[]) => string;
}

const EN: Words = {
  choice: (label, to) => (label ? `${label} — turn to ${to}` : `turn to ${to}`),
  turnTo: (to) => `turn to ${to}`,
  wentThisWay: ' (you went this way)',
  notTaken: ' (not taken)',
  returnTo: (to) => `return to ${to}`,
  beginAgain: 'Begin again',
  storyEnds: 'Your story ends here.',
  journeys: 'Your journeys',
  thisOne: 'This one',
  theOneBefore: 'The one before',
  earlier: 'Earlier',
  sectionsRead: (count, unseen) =>
    `You have read ${count} ${count === 1 ? 'section' : 'sections'}` +
    (unseen.length > 0 ? `, and have never seen ${unseen.join(', ')}.` : '.'),
};

// The genre's own vocabulary rather than a translation of the English: a French
// gamebook has said « rendez-vous au 45 » since before this platform existed.
// U+2019 for the apostrophe, which is what French typography wants.
const FR: Words = {
  choice: (label, to) => (label ? `${label} — rendez-vous au ${to}` : `rendez-vous au ${to}`),
  turnTo: (to) => `rendez-vous au ${to}`,
  wentThisWay: ' (vous avez pris ce chemin)',
  notTaken: ' (chemin non emprunté)',
  returnTo: (to) => `revenez au ${to}`,
  beginAgain: 'Recommencer',
  storyEnds: 'Votre aventure s’achève ici.',
  journeys: 'Vos parcours',
  thisOne: 'Celui-ci',
  theOneBefore: 'Le précédent',
  earlier: 'Plus tôt',
  // French keeps the singular at zero, which English does not.
  sectionsRead: (count, unseen) =>
    `Vous avez lu ${count} ${count > 1 ? 'sections' : 'section'}` +
    (unseen.length > 0 ? `, et n’avez jamais vu ${unseen.join(', ')}.` : '.'),
};

const KNOWN: Record<string, Words> = { en: EN, fr: FR };

/**
 * Matched on the **primary subtag**, so `fr-CA` and `fr` read the same book.
 * An unknown or absent language falls back to English, which is what every
 * book got before the descriptor could say otherwise.
 */
export function wordsFor(language?: string): Words {
  return KNOWN[(language ?? '').toLowerCase().split('-')[0]] ?? EN;
}
