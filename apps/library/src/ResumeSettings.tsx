import { useState } from 'react';
import { getResumeMode, setResumeMode, type ResumeMode } from '@smart-ebooks/engine';

const LABELS: Record<ResumeMode, string> = {
  shelf: 'Always show my library',
  instant: 'Open my last book',
  cover: 'Open my last book, with its cover',
};

/**
 * How the platform should open on a return visit. A device preference, so it
 * lives with the library rather than inside any one book.
 */
export function ResumeSettings() {
  const [mode, setMode] = useState<ResumeMode>(() => getResumeMode());

  return (
    <label className="shelf__setting">
      <span>When I come back</span>
      <select
        value={mode}
        data-testid="resume-mode"
        onChange={(event) => {
          const next = event.target.value as ResumeMode;
          setMode(next);
          setResumeMode(next);
        }}
      >
        {(Object.keys(LABELS) as ResumeMode[]).map((value) => (
          <option key={value} value={value}>
            {LABELS[value]}
          </option>
        ))}
      </select>
    </label>
  );
}
