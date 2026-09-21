import { createContext, useContext, useMemo } from 'react';
import {
  getLanguageChoice,
  type LanguageChoice,
  type TextFace,
  type TextLeading,
  type TextMeasure,
  type TextSize,
  type Theme,
} from '../store/platformSettings';

/**
 * What the **shell** says out loud (SPEC015).
 *
 * The other half of SPEC010. A book declares its own language and its prose
 * follows it; these are the words that belong to the *device* — the furniture
 * around the book, not the book. The test for which is which is SPEC015 §2:
 * would it be printed in the book? « rendez-vous au 45 » would, so the gamebook
 * pack owns it. "Contents" would not.
 *
 * So a French book read on an English device keeps French prose inside English
 * chrome, deliberately. It reads like a bug and is not one.
 *
 * **Whole sentences, and a function wherever a value appears**, which is
 * `words.ts`'s rule and it was learned the hard way: stitching a label to a
 * colon to a value is how a translation comes out as nonsense, because neither
 * the word order nor the punctuation is ours to assume. French puts a space
 * before its colon; English does not.
 *
 * **A typed record rather than a catalogue file**, so that a missing message is
 * a compile error rather than a blank button in one language.
 */
export interface Messages {
  contents: string;
  search: string;
  /** The theme's own name, as the button shows it. */
  themeName: Record<Theme, string>;
  /** The button's accessible name, which has to say what activating it does. */
  themeAction: (name: string) => string;
  /** The tooltip, which does not. */
  themeTitle: (name: string) => string;
  /**
   * An island the book asked for and the reader cannot have, for a reason that
   * is the *author's* — an unknown directive, a missing source, an empty game.
   *
   * One message for all of them on purpose (SPEC015 L1.6). The reader can act
   * on none of it, and naming the directive told them which word the author got
   * wrong in a language they may not read. The detail goes to the console,
   * where `IslandBoundary` already sends its own.
   */
  islandBroken: string;
  /** An island the book asked for and an *imported* book is not allowed to run. */
  islandBlocked: string;

  /** The control's accessible name; the visible one is shortened to fit a phone. */
  readingSettings: string;
  readingSettingsShort: string;
  textSize: string;
  lineSpacing: string;
  lineLength: string;
  typeface: string;
  resetToDefaults: string;
  /**
   * One record per setting, though `normal` appears in two of them.
   *
   * Sharing a single map keyed by the value looked like deduplication and is a
   * translation bug: in French the spacing is an *interligne* and the measure a
   * *longueur*, so the same English "Normal" has to be `Normal` in one and
   * `Normale` in the other.
   */
  textSizeName: Record<TextSize, string>;
  lineSpacingName: Record<TextLeading, string>;
  lineLengthName: Record<TextMeasure, string>;
  typefaceName: Record<TextFace, string>;

  /** The dialog's accessible name. The book's title is never translated. */
  searchIn: (title: string) => string;
  searchThisBook: string;
  searchPlaceholder: string;
  close: string;
  searchPrompt: string;
  searchNoMatches: string;
  /**
   * *"9 matching passages in 2 chapters"*, as one sentence.
   *
   * It was assembled in the JSX from two counts and two ternaries, which is the
   * shape `words.ts` warns about: the agreement is not ours to assume. French
   * inflects the participle as well as the noun, and keeps the singular at
   * zero where English does not.
   */
  searchCount: (passages: number, chapters: number) => string;
}

const EN: Messages = {
  contents: 'Contents',
  search: 'Search',
  themeName: { light: 'Light', dark: 'Dark', system: 'System' },
  themeAction: (name) => `Theme: ${name}. Activate to change.`,
  themeTitle: (name) => `Theme: ${name}`,
  islandBroken: 'This part of the book could not be shown.',
  islandBlocked: 'Imported books are not allowed to play this.',
  readingSettings: 'Reading settings',
  readingSettingsShort: 'Reading',
  textSize: 'Text size',
  lineSpacing: 'Line spacing',
  lineLength: 'Line length',
  typeface: 'Typeface',
  resetToDefaults: 'Reset to defaults',
  textSizeName: { small: 'Small', medium: 'Medium', large: 'Large', xlarge: 'Extra large' },
  lineSpacingName: { tight: 'Tight', normal: 'Normal', loose: 'Loose' },
  lineLengthName: { narrow: 'Narrow', normal: 'Normal', wide: 'Wide' },
  typefaceName: { sans: 'Sans', serif: 'Serif' },
  searchIn: (title) => `Search ${title}`,
  searchThisBook: 'Search this book',
  searchPlaceholder: 'Search this book…',
  close: 'Close',
  searchPrompt: 'Type to search this book.',
  searchNoMatches: 'No matches.',
  searchCount: (passages, chapters) =>
    `${passages} matching ${passages === 1 ? 'passage' : 'passages'} in ` +
    `${chapters} ${chapters === 1 ? 'chapter' : 'chapters'}`,
};

// U+00A0 before the colon, which is what French typography wants and what a
// naive `${label}: ${value}` would silently get wrong.
const FR: Messages = {
  contents: 'Sommaire',
  search: 'Rechercher',
  themeName: { light: 'Clair', dark: 'Sombre', system: 'Système' },
  themeAction: (name) => `Thème\u00a0: ${name}. Activer pour changer.`,
  themeTitle: (name) => `Thème\u00a0: ${name}`,
  islandBroken: 'Cette partie du livre n’a pas pu être affichée.',
  islandBlocked: 'Un livre importé n’est pas autorisé à lire ce contenu.',
  readingSettings: 'Réglages de lecture',
  readingSettingsShort: 'Lecture',
  textSize: 'Taille du texte',
  lineSpacing: 'Interligne',
  lineLength: 'Longueur de ligne',
  typeface: 'Police',
  resetToDefaults: 'Rétablir les valeurs par défaut',
  textSizeName: { small: 'Petite', medium: 'Moyenne', large: 'Grande', xlarge: 'Très grande' },
  // *Interligne* is masculine and *longueur* feminine, which is the whole
  // reason these are two records and not one.
  lineSpacingName: { tight: 'Serré', normal: 'Normal', loose: 'Aéré' },
  lineLengthName: { narrow: 'Étroite', normal: 'Normale', wide: 'Large' },
  typefaceName: { sans: 'Sans empattement', serif: 'Avec empattements' },
  searchIn: (title) => `Rechercher dans ${title}`,
  searchThisBook: 'Rechercher dans ce livre',
  searchPlaceholder: 'Rechercher dans ce livre…',
  close: 'Fermer',
  searchPrompt: 'Saisissez un mot à rechercher.',
  searchNoMatches: 'Aucun résultat.',
  // The participle agrees as well as the noun, and French keeps the singular at
  // one *and* at zero — which is why this is a sentence and not two ternaries.
  searchCount: (passages, chapters) =>
    `${passages} passage${passages > 1 ? 's' : ''} trouvé${passages > 1 ? 's' : ''} ` +
    `dans ${chapters} chapitre${chapters > 1 ? 's' : ''}`,
};

export type Language = 'en' | 'fr';

export const LANGUAGES: Language[] = ['en', 'fr'];

const CATALOGUE: Record<Language, Messages> = { en: EN, fr: FR };

export function messagesFor(language: Language): Messages {
  return CATALOGUE[language];
}

/** Matched on the **primary subtag**, so `fr-CA` and `fr` read the same shell. */
function spoken(tag: string): Language | undefined {
  const primary = tag.toLowerCase().split('-')[0];
  return LANGUAGES.find((known) => known === primary);
}

/**
 * The language to speak, given what the reader chose and what their device asks
 * for, in that order of authority.
 *
 * Pure, and takes the device's list rather than reading `navigator`, because
 * the interesting cases — a preference for a language we do not have, a region
 * subtag, an empty list — are the ones a test has to be able to state.
 */
export function resolveLanguage(
  choice: LanguageChoice,
  preferred: readonly string[] = [],
): Language {
  if (choice !== 'system') return spoken(choice) ?? 'en';
  for (const tag of preferred) {
    const known = spoken(tag);
    if (known) return known;
  }
  return 'en';
}

/** What this device would read, absent anything overriding it. */
export function deviceLanguage(): Language {
  const preferred =
    typeof navigator === 'undefined' ? [] : (navigator.languages ?? [navigator.language]);
  return resolveLanguage(getLanguageChoice(), preferred);
}

/**
 * `<html lang>` is the **shell's** language; `<article lang>` stays the book's
 * (`ChapterView`). Both are needed: a screen reader and a hyphenation engine
 * follow the nearest declaration, and on this page the nearest one changes
 * halfway down.
 */
export function applyDocumentLanguage(language: Language): void {
  document.documentElement.lang = language;
}

/** Consumed by `MessagesProvider`, which lives apart so this file exports no component. */
export const MessagesContext = createContext<Messages | null>(null);

/** Falls back to the device, so nothing has to be wrapped for the default to work. */
export function useMessages(): Messages {
  const provided = useContext(MessagesContext);
  const fromDevice = useMemo(() => messagesFor(deviceLanguage()), []);
  return provided ?? fromDevice;
}
