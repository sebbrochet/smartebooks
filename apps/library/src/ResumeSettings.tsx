import { useState } from 'react';
import { getResumeMode, setResumeMode, useMessages, type ResumeMode } from '@smart-ebooks/engine';

const MODES: ResumeMode[] = ['shelf', 'instant', 'cover'];

/**
 * How the platform should open on a return visit. A device preference, so it
 * lives with the library rather than inside any one book.
 */
export function ResumeSettings() {
  const [mode, setMode] = useState<ResumeMode>(() => getResumeMode());
  const words = useMessages();

  return (
    <label className="shelf__setting">
      <span>{words.resumeWhenIComeBack}</span>
      <select
        value={mode}
        data-testid="resume-mode"
        onChange={(event) => {
          const next = event.target.value as ResumeMode;
          setMode(next);
          setResumeMode(next);
        }}
      >
        {MODES.map((value) => (
          <option key={value} value={value}>
            {words.resumeModeName[value]}
          </option>
        ))}
      </select>
    </label>
  );
}
