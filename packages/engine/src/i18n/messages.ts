import { createContext, useContext, useMemo } from 'react';
import {
  getLanguageChoice,
  type LanguageChoice,
  type ResumeMode,
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

  chapterNavigation: string;
  bookNavigation: string;
  onThisPage: string;
  searchResults: string;
  /** Empty query gives the bare word; a query is quoted the way the language quotes. */
  searchHeading: (query: string) => string;
  /** The search *view*, which is a page; `searchNoMatches` is the overlay. */
  searchViewEmpty: string;
  searchViewHint: string;
  overviewOf: (title: string) => string;
  chapterCount: (chapters: number) => string;
  quizzesAnswered: (taken: number, total: number) => string;
  pointsScored: (score: number, points: number) => string;
  noQuiz: string;
  pointsUnanswered: (points: number) => string;
  chapterScore: (score: number, points: number, taken: number, quizzes: number) => string;

  library: string;
  tools: string;
  skipToContent: string;
  updateReady: string;
  reloadToUpdate: string;
  imported: string;
  resumeWhenIComeBack: string;
  resumeModeName: Record<ResumeMode, string>;
  exportProgress: string;
  exportProgressHint: (scope: string) => string;
  scopeThisBook: string;
  scopeAllBooks: string;
  importProgress: string;
  importProgressHint: string;
  importFailed: string;
  importedCounts: (entries: number, books: number) => string;
  exportBook: string;
  exportBookHint: string;
  importBook: string;
  importedTitled: (title: string) => string;
  /** Answers kept from an edition that no longer has the questions (SPEC003 E1.2). */
  importedWithOrphans: (title: string, orphans: number, named: string, more: boolean) => string;
  importCancelled: string;
  importAnyway: string;
  replaceWithOlder: (title: string) => string;
  replaceEditions: (incoming: string, held: string) => string;
  replaceKeepsProgress: string;
  deleteBook: string;
  deleteAction: string;
  shelfIntro: string;
  deleteKeepsFile: string;
  deleteBookTitled: (title: string) => string;
  deleteImportedBook: (title: string) => string;
  deleteRemovesFromLibrary: string;
  resetProgress: string;
  resetProgressIn: (title: string) => string;
  resetProgressClears: string;
  resetProgressStorage: string;
  resetProgressUndone: (exportLabel: string) => string;
  resumeContinueNow: string;
  resumeGoToLibrary: string;
  resuming: (title: string) => string;

  /** Used when the author gave the media no title of their own. */
  audio: string;
  video: string;
  audioOffline: string;
  videoOffline: string;
  videoFacadeNotice: string;
  videoFacadePlay: (title: string) => string;
  mediaMoments: string;
  mediaNoMarks: string;
  checkpointDefault: string;
  flashcardFront: string;
  flashcardBack: string;
  flashcardGrading: string;
  flashcardGrade: Record<'again' | 'good' | 'easy', string>;
  flashcardStreak: (reps: number) => string;
  matchingSolved: (moves: number) => string;
  matchingBest: (best: number) => string;
  matchingMoves: (moves: number) => string;
  playAgain: string;
  reset: string;
  quiz: string;
  checkAnswers: string;
  tryAgain: string;
  quizScore: (score: number, total: number) => string;
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
  chapterNavigation: 'Chapter navigation',
  bookNavigation: 'Book navigation',
  onThisPage: 'On this page',
  searchResults: 'Search results',
  searchHeading: (query) => (query ? `Search: “${query}”` : 'Search'),
  searchViewEmpty: 'No results found.',
  searchViewHint: 'Type a term in the search box to find content across this book.',
  overviewOf: (title) => `Overview of ${title}`,
  chapterCount: (chapters) => `${chapters} ${chapters === 1 ? 'chapter' : 'chapters'}`,
  quizzesAnswered: (taken, total) => `${taken} of ${total} quizzes answered`,
  pointsScored: (score, points) => `${score}/${points} points`,
  noQuiz: 'No quiz',
  pointsUnanswered: (points) => `${points} ${points === 1 ? 'point' : 'points'} unanswered`,
  chapterScore: (score, points, taken, quizzes) =>
    `${score}/${points} points · ${taken}/${quizzes} quizzes`,
  library: 'Library',
  tools: 'Tools',
  skipToContent: 'Skip to content',
  updateReady: 'A new version of Smart Ebooks is ready.',
  reloadToUpdate: 'Reload to update',
  imported: 'Imported',
  resumeWhenIComeBack: 'When I come back',
  resumeModeName: {
    shelf: 'Always show my library',
    instant: 'Open my last book',
    cover: 'Open my last book, with its cover',
  },
  exportProgress: 'Export progress',
  exportProgressHint: (scope) => `Download a backup of progress for ${scope}`,
  scopeThisBook: 'this book',
  scopeAllBooks: 'all books',
  importProgress: 'Import progress',
  importProgressHint: 'Restore progress from a backup file',
  importFailed: 'Import failed.',
  importedCounts: (entries, books) =>
    `Imported ${entries} item${entries === 1 ? '' : 's'} across ` +
    `${books} book${books === 1 ? '' : 's'}.`,
  exportBook: 'Export book',
  exportBookHint: 'Download this book as a .smartbook package',
  importBook: 'Import book',
  importedTitled: (title) => `Imported “${title}”.`,
  importedWithOrphans: (title, orphans, named, more) =>
    `Imported “${title}”. ${orphans} saved ${orphans === 1 ? 'answer is' : 'answers are'} ` +
    `not in this edition (${named}${more ? '…' : ''}). Nothing was deleted.`,
  importCancelled: 'Import cancelled — you kept the edition you had.',
  importAnyway: 'Import anyway',
  replaceWithOlder: (title) => `Replace ${title} with an older edition?`,
  replaceEditions: (incoming, held) =>
    `This file is edition ${incoming}. You already have ${held}, which is newer.`,
  replaceKeepsProgress: 'Your progress is kept either way, but the book’s text will go back.',
  deleteBook: 'Delete book',
  deleteAction: 'Delete',
  shelfIntro:
    'Every book below runs on the same Smart Ebooks engine. Pick one to start reading, or import a .smartbook package.',
  deleteKeepsFile:
    'The .smartbook file on your computer is not touched, and your progress and scores are kept if you import this book again.',
  deleteBookTitled: (title) => `Delete ${title}?`,
  deleteImportedBook: (title) => `Delete imported book ${title}`,
  deleteRemovesFromLibrary: 'This removes the book from your library.',
  resetProgress: 'Reset progress',
  resetProgressIn: (title) => `Reset your progress in ${title}?`,
  resetProgressClears:
    'This clears every quiz score, checkpoint and reading position for this book on this device.',
  resetProgressStorage:
    'Your progress and scores are stored locally in your browser. Nothing is sent to a server.',
  resetProgressUndone: (exportLabel) =>
    `It cannot be undone. If you want to keep a copy, cancel and use ${exportLabel} first.`,
  resumeContinueNow: 'Continue now',
  resumeGoToLibrary: 'Go to library instead',
  resuming: (title) => `Resuming ${title}…`,
  audio: 'Audio',
  video: 'Video',
  audioOffline: 'This audio is not part of the book and needs a connection to play.',
  videoOffline: 'This video is not part of the book and needs a connection to play.',
  videoFacadeNotice: 'Loads from YouTube when you press play',
  videoFacadePlay: (title) => `Play ${title} (loads from YouTube)`,
  mediaMoments: 'Moments in this recording',
  mediaNoMarks: 'This lesson has no marks to show.',
  checkpointDefault: 'Mark this section as complete',
  flashcardFront: 'Front — tap to reveal',
  flashcardBack: 'Back — tap to flip back',
  flashcardGrading: 'How well did you know it?',
  flashcardGrade: { again: 'Again', good: 'Good', easy: 'Easy' },
  flashcardStreak: (reps) => `Review streak: ${reps}`,
  matchingSolved: (moves) => `Solved in ${moves} ${moves === 1 ? 'move' : 'moves'}!`,
  matchingBest: (best) => `Best: ${best}`,
  matchingMoves: (moves) => `Moves: ${moves}`,
  playAgain: 'Play again',
  reset: 'Reset',
  quiz: 'Quiz',
  checkAnswers: 'Check answers',
  tryAgain: 'Try again',
  quizScore: (score, total) => `Score: ${score} / ${total}`,
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
  chapterNavigation: 'Navigation entre chapitres',
  bookNavigation: 'Navigation dans le livre',
  onThisPage: 'Sur cette page',
  searchResults: 'Résultats de recherche',
  // Guillemets, and the space before the colon: both belong to the language.
  searchHeading: (query) => (query ? `Recherche\u00a0: «\u00a0${query}\u00a0»` : 'Recherche'),
  searchViewEmpty: 'Aucun résultat.',
  searchViewHint: 'Saisissez un terme dans la zone de recherche pour parcourir ce livre.',
  overviewOf: (title) => `Vue d’ensemble de ${title}`,
  chapterCount: (chapters) => `${chapters} chapitre${chapters > 1 ? 's' : ''}`,
  // *Quiz* does not take an -s in French; the participle agreeing with it does.
  quizzesAnswered: (taken, total) => `${taken} quiz sur ${total} complété${taken > 1 ? 's' : ''}`,
  pointsScored: (score, points) => `${score}/${points} points`,
  noQuiz: 'Aucun quiz',
  pointsUnanswered: (points) => `${points} point${points > 1 ? 's' : ''} en attente`,
  chapterScore: (score, points, taken, quizzes) =>
    `${score}/${points} points · ${taken}/${quizzes} quiz`,
  library: 'Bibliothèque',
  tools: 'Outils',
  skipToContent: 'Aller au contenu',
  updateReady: 'Une nouvelle version de Smart Ebooks est disponible.',
  reloadToUpdate: 'Recharger pour mettre à jour',
  imported: 'Importé',
  resumeWhenIComeBack: 'À mon retour',
  resumeModeName: {
    shelf: 'Toujours afficher ma bibliothèque',
    instant: 'Ouvrir mon dernier livre',
    cover: 'Ouvrir mon dernier livre, avec sa couverture',
  },
  exportProgress: 'Exporter ma progression',
  exportProgressHint: (scope) => `Télécharger une sauvegarde de la progression pour ${scope}`,
  scopeThisBook: 'ce livre',
  scopeAllBooks: 'tous les livres',
  importProgress: 'Importer une progression',
  importProgressHint: 'Restaurer la progression depuis un fichier de sauvegarde',
  importFailed: 'L’import a échoué.',
  importedCounts: (entries, books) =>
    `${entries} élément${entries > 1 ? 's' : ''} importé${entries > 1 ? 's' : ''} ` +
    `dans ${books} livre${books > 1 ? 's' : ''}.`,
  exportBook: 'Exporter le livre',
  exportBookHint: 'Télécharger ce livre au format .smartbook',
  importBook: 'Importer un livre',
  importedTitled: (title) => `«\u00a0${title}\u00a0» importé.`,
  importedWithOrphans: (title, orphans, named, more) =>
    `«\u00a0${title}\u00a0» importé. ${orphans} réponse${orphans > 1 ? 's' : ''} enregistrée${
      orphans > 1 ? 's' : ''
    } ${orphans > 1 ? 'ne figurent' : 'ne figure'} pas dans cette édition ` +
    `(${named}${more ? '…' : ''}). Rien n’a été supprimé.`,
  importCancelled: 'Import annulé — vous avez gardé l’édition que vous aviez.',
  importAnyway: 'Importer quand même',
  replaceWithOlder: (title) => `Remplacer ${title} par une édition plus ancienne\u00a0?`,
  replaceEditions: (incoming, held) =>
    `Ce fichier est l’édition ${incoming}. Vous avez déjà ${held}, qui est plus récente.`,
  replaceKeepsProgress:
    'Votre progression est conservée dans les deux cas, mais le texte du livre reviendra en arrière.',
  deleteBook: 'Supprimer le livre',
  deleteAction: 'Supprimer',
  shelfIntro:
    'Chaque livre ci-dessous fonctionne sur le même moteur Smart Ebooks. Choisissez-en un pour commencer, ou importez un paquet .smartbook.',
  deleteKeepsFile:
    'Le fichier .smartbook sur votre ordinateur n’est pas touché, et votre progression et vos scores sont conservés si vous réimportez ce livre.',
  deleteBookTitled: (title) => `Supprimer ${title}\u00a0?`,
  deleteImportedBook: (title) => `Supprimer le livre importé ${title}`,
  deleteRemovesFromLibrary: 'Le livre est retiré de votre bibliothèque.',
  resetProgress: 'Effacer ma progression',
  resetProgressIn: (title) => `Effacer votre progression dans ${title}\u00a0?`,
  resetProgressClears:
    'Cela efface tous les scores de quiz, les jalons et la position de lecture de ce livre sur cet appareil.',
  resetProgressStorage:
    'Votre progression et vos scores sont enregistrés localement dans votre navigateur. Rien n’est envoyé à un serveur.',
  resetProgressUndone: (exportLabel) =>
    `C’est irréversible. Pour en garder une copie, annulez et utilisez d’abord ${exportLabel}.`,
  resumeContinueNow: 'Continuer maintenant',
  resumeGoToLibrary: 'Aller à la bibliothèque',
  resuming: (title) => `Reprise de ${title}…`,
  audio: 'Audio',
  video: 'Vidéo',
  audioOffline: 'Cet audio ne fait pas partie du livre et nécessite une connexion pour être lu.',
  videoOffline: 'Cette vidéo ne fait pas partie du livre et nécessite une connexion pour être lue.',
  videoFacadeNotice: 'Chargée depuis YouTube quand vous lancez la lecture',
  videoFacadePlay: (title) => `Lire ${title} (chargement depuis YouTube)`,
  mediaMoments: 'Moments de cet enregistrement',
  mediaNoMarks: 'Cette leçon n’a aucun repère à afficher.',
  checkpointDefault: 'Marquer cette section comme terminée',
  flashcardFront: 'Recto — appuyez pour révéler',
  flashcardBack: 'Verso — appuyez pour retourner',
  flashcardGrading: 'Connaissiez-vous la réponse\u00a0?',
  flashcardGrade: { again: 'À revoir', good: 'Bien', easy: 'Facile' },
  flashcardStreak: (reps) => `Série de révisions\u00a0: ${reps}`,
  matchingSolved: (moves) => `Résolu en ${moves} coup${moves > 1 ? 's' : ''}\u00a0!`,
  matchingBest: (best) => `Meilleur\u00a0: ${best}`,
  matchingMoves: (moves) => `Coups\u00a0: ${moves}`,
  playAgain: 'Rejouer',
  reset: 'Réinitialiser',
  quiz: 'Quiz',
  checkAnswers: 'Vérifier les réponses',
  tryAgain: 'Réessayer',
  quizScore: (score, total) => `Score\u00a0: ${score} / ${total}`,
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
