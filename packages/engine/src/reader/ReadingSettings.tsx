import { useEffect, useRef, useState } from 'react';
import {
  TEXT_FACES,
  TEXT_LEADINGS,
  TEXT_MEASURES,
  TEXT_SIZES,
  type ReadingPreferences,
} from '../store/platformSettings';
import { useReadingPreferences } from './useReadingPreferences';

/** The words a reader would use, rather than the values they map to. */
const LABELS: Record<string, string> = {
  small: 'Small',
  medium: 'Medium',
  large: 'Large',
  xlarge: 'Extra large',
  tight: 'Tight',
  normal: 'Normal',
  loose: 'Loose',
  narrow: 'Narrow',
  wide: 'Wide',
  sans: 'Sans',
  serif: 'Serif',
};

/**
 * Type size, spacing, line length and face.
 *
 * Behind one button because these are settled once and then left alone —
 * putting four controls permanently in the header would spend the space a
 * reader looks at constantly on the thing they touch least (SPEC002 S8).
 *
 * Theme stays outside deliberately: it is the one reading control people change
 * *while* reading, when the light in the room changes.
 */
export function ReadingSettings() {
  const { preferences, update, reset } = useReadingPreferences();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // A popover that survives a click elsewhere is a popover in the way. Escape
  // returns focus to the button that opened it, so the keyboard does not
  // restart from the top of the document.
  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Escape') return;
      setOpen(false);
      buttonRef.current?.focus();
    }

    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  return (
    <div className="reading-settings" ref={rootRef}>
      <button
        type="button"
        ref={buttonRef}
        className="theme-toggle"
        aria-expanded={open}
        aria-controls="reading-settings"
        onClick={() => setOpen((was) => !was)}
      >
        <span aria-hidden="true">Aa</span> Reading
      </button>

      <div className="reading-settings__panel" id="reading-settings" hidden={!open}>
        <Choice
          legend="Text size"
          options={TEXT_SIZES}
          value={preferences.size}
          onChange={(value) => update('size', value)}
        />
        <Choice
          legend="Line spacing"
          options={TEXT_LEADINGS}
          value={preferences.leading}
          onChange={(value) => update('leading', value)}
        />
        <Choice
          legend="Line length"
          options={TEXT_MEASURES}
          value={preferences.measure}
          onChange={(value) => update('measure', value)}
        />
        <Choice
          legend="Typeface"
          options={TEXT_FACES}
          value={preferences.face}
          onChange={(value) => update('face', value)}
        />
        <button type="button" className="reading-settings__reset" onClick={reset}>
          Reset to defaults
        </button>
      </div>
    </div>
  );
}

/**
 * One setting, as a group of radios.
 *
 * Radios rather than a select or a pair of +/− buttons: every option is visible
 * and one press away, and a `fieldset` tells a screen reader what the group is
 * for without a label per button.
 */
function Choice<T extends string>({
  legend,
  options,
  value,
  onChange,
}: {
  legend: string;
  options: T[];
  value: T;
  onChange: (value: T) => void;
}) {
  const name = `reading-${legend.replace(/\s+/g, '-').toLowerCase()}`;

  return (
    <fieldset className="reading-settings__group">
      <legend>{legend}</legend>
      <div className="reading-settings__options">
        {options.map((option) => (
          <label key={option} className={option === value ? 'is-selected' : undefined}>
            <input
              type="radio"
              name={name}
              value={option}
              checked={option === value}
              onChange={() => onChange(option)}
            />
            {LABELS[option] ?? option}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export type { ReadingPreferences };
