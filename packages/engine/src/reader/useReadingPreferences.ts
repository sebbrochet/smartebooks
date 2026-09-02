import { useCallback, useEffect, useState } from 'react';
import {
  DEFAULT_READING,
  getReadingPreferences,
  setReadingPreferences,
  type ReadingPreferences,
} from '../store/platformSettings';

/**
 * The reader's own typography, applied to `<html>` as data attributes.
 *
 * **Attributes, not inline styles.** An inline style would win over everything
 * including a print rule or a future skin, which sounds like the right answer
 * for a reader preference and is not: it takes the value out of CSS entirely,
 * so nothing downstream can adapt to it. The attribute selects a set of tokens
 * declared in the `reader` layer, which the cascade already places above the
 * platform's defaults (SPEC009 T3/T6).
 */
export function applyReadingPreferences(preferences: ReadingPreferences): void {
  const root = document.documentElement;
  root.setAttribute('data-text-size', preferences.size);
  root.setAttribute('data-text-leading', preferences.leading);
  root.setAttribute('data-text-measure', preferences.measure);
  root.setAttribute('data-text-face', preferences.face);
}

export function useReadingPreferences() {
  const [preferences, setState] = useState<ReadingPreferences>(getReadingPreferences);

  useEffect(() => {
    applyReadingPreferences(preferences);
    setReadingPreferences(preferences);
  }, [preferences]);

  const update = useCallback(
    <K extends keyof ReadingPreferences>(key: K, value: ReadingPreferences[K]) => {
      setState((current) => ({ ...current, [key]: value }));
    },
    [],
  );

  const reset = useCallback(() => setState(DEFAULT_READING), []);

  return { preferences, update, reset };
}
