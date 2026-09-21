import { useState } from 'react';
import {
  LANGUAGES,
  LANGUAGE_NAMES,
  chooseLanguage,
  languageChoice,
  useMessages,
} from '@smart-ebooks/engine';

/**
 * Which language the shell speaks (SPEC015 L1.4).
 *
 * In the tools disclosure rather than the header: the header comment above
 * `reader__tools` says what earns a permanent button — *"controls a reader
 * touches once a month"* was the argument for moving everything else out, and
 * a language is set once and usually never, because the browser already
 * answered. Tools is also the only surface on both the shelf and the reader.
 *
 * The options name themselves — English, Français — which is what a picker
 * should show and means the list needs no translating as it grows.
 */
export function LanguageSettings() {
  const words = useMessages();
  const [choice, setChoice] = useState(() => languageChoice());

  return (
    <label className="reader__setting">
      <span>{words.languageSetting}</span>
      <select
        value={choice}
        data-testid="language-choice"
        onChange={(event) => {
          setChoice(event.target.value);
          chooseLanguage(event.target.value);
        }}
      >
        <option value="system">{words.languageFollowDevice}</option>
        {LANGUAGES.map((language) => (
          <option key={language} value={language}>
            {LANGUAGE_NAMES[language]}
          </option>
        ))}
      </select>
    </label>
  );
}
