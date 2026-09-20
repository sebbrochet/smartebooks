import { createContext, useContext, useMemo } from 'react';
import { getLanguageChoice, type LanguageChoice, type Theme } from '../store/platformSettings';

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
}

const EN: Messages = {
  contents: 'Contents',
  search: 'Search',
  themeName: { light: 'Light', dark: 'Dark', system: 'System' },
  themeAction: (name) => `Theme: ${name}. Activate to change.`,
  themeTitle: (name) => `Theme: ${name}`,
};

// U+00A0 before the colon, which is what French typography wants and what a
// naive `${label}: ${value}` would silently get wrong.
const FR: Messages = {
  contents: 'Sommaire',
  search: 'Rechercher',
  themeName: { light: 'Clair', dark: 'Sombre', system: 'Système' },
  themeAction: (name) => `Thème\u00a0: ${name}. Activer pour changer.`,
  themeTitle: (name) => `Thème\u00a0: ${name}`,
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
