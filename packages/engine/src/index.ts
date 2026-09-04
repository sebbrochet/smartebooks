/**
 * Public API of the Smart Ebooks engine — the single reusable core shared by
 * the platform (bookshelf) and any standalone single-book app.
 */

// Types
export type {
  Book,
  BookMeta,
  Chapter,
  IslandComponent,
  IslandComponentProps,
  QuizQuestion,
  QuizOption,
  FlashcardData,
} from './types';

// Reader shell
export { Reader, type ReaderProps } from './Reader';
export { BookProvider, useBook } from './reader/BookContext';
export { usePersistentState } from './store/usePersistentState';
export { useAssetResolver, type AssetResolver } from './reader/useAssetResolver';
export { ThemeToggle } from './reader/ThemeToggle';
export { ReadingSettings } from './reader/ReadingSettings';
export { useReadingPreferences, applyReadingPreferences } from './reader/useReadingPreferences';
export {
  getReadingPreferences,
  setReadingPreferences,
  DEFAULT_READING,
  type ReadingPreferences,
} from './store/platformSettings';
export { useMediaQuery, NARROW } from './reader/useMediaQuery';
export { useTheme, applyTheme, getStoredTheme, type Theme } from './reader/useTheme';
export { searchChapters, type SearchResult } from './reader/search';

// Content + rendering
export { renderMarkdown } from './markdown/render';
export { mdastToText, extractDirectiveCode, extractJsonConfig } from './markdown/extract';

// Book packaging (.smartbook)
export { makeBook } from './package/makeBook';
export { packBookAssets } from './package/bookAssets';
export { exportBookToZip } from './package/exportBook';
export {
  collectDirectiveNames,
  deriveRequiredIslands,
  missingIslands,
} from './package/islandRequirements';
export { parseSmartbook, type ImportedPackage } from './package/importBook';
export {
  saveImportedBook,
  listImportedBooks,
  getImportedBook,
  deleteImportedBook,
  makeImportedBook,
  type StoredImport,
} from './store/importedBooks';
export {
  SMARTBOOK_SCHEMA_VERSION,
  MIN_SUPPORTED_SCHEMA,
  isPublic,
  type SmartbookDescriptor,
  type SmartbookChapterEntry,
  type SmartbookEngineRange,
  type SmartbookIslands,
  type SmartbookVisibility,
} from './package/spec';
export {
  isAuthorId,
  isEdition,
  parseEdition,
  compareEditions,
  type Edition,
} from './package/edition';

// Persistence
export {
  readBookStats,
  clearBook,
  clearAllBooks,
  subscribeToStore,
  exportProgress,
  importProgress,
  reading,
  type ReadingPosition,
  type BookStats,
  type ProgressBackup,
  type ImportProgressResult,
} from './store/store';

// Platform-level settings (device preferences, not book state)
export {
  getTheme,
  setTheme,
  getResumeMode,
  setResumeMode,
  getLastRead,
  setLastRead,
  clearLastRead,
  migrateLegacySettings,
  RESUME_MODES,
  type ResumeMode,
  type LastRead,
} from './store/platformSettings';

// Extensibility (island plugin API)
export {
  createIslandRegistry,
  type IslandRegistry,
  type IslandDefinition,
  type DirectiveNode,
} from './islandRegistry';
export { defaultIslands } from './islands/defaults';
export { createSequence, type SequenceValue, type SequenceProviderProps } from './islands/sequence';
export {
  resolveAttributes,
  attrText,
  attrFlag,
  attrNumber,
  type AttributeSpec,
  type AttributeValue,
  type AttributeProblem,
} from './islands/attributes';
