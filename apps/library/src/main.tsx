import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
// Self-hosted, from npm rather than a font CDN: a webfont request to a third
// party would contradict the rule that nothing third-party is fetched until the
// reader asks for it, and it would make the reader's IP a matter for someone
// else's server on every page. Both families are SIL OFL, and their licences
// travel in the packages.
//
// These are the *variable* builds — one file covers every weight — and each
// `@font-face` is `unicode-range` scoped by subset, so an English reader
// downloads the ~47 kB latin file and nothing else. The other subsets are built
// but never fetched, which costs disk in `dist` and nothing on the wire; the
// alternative, importing latin alone, would quietly cripple the first Greek or
// Cyrillic book anyone writes.
import '@fontsource-variable/inter/wght.css';
import '@fontsource-variable/jetbrains-mono/wght.css';
import { applyDocumentLanguage, deviceLanguage } from '@smart-ebooks/engine';
import App from './App';

// `<html lang>` is the shell's language, not the book's — the book declares its
// own and `ChapterView` puts it on the article (SPEC015 L1.3).
applyDocumentLanguage(deviceLanguage());

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
