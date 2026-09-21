import { useEffect, useRef, useState } from 'react';
import {
  TEXT_FACES,
  TEXT_LEADINGS,
  TEXT_MEASURES,
  TEXT_SIZES,
  type ReadingPreferences,
} from '../store/platformSettings';
import { useMessages } from '../i18n/messages';
import { useReadingPreferences } from './useReadingPreferences';
import { Icon } from './Icon';

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
  const words = useMessages();
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
        className="ui-btn theme-toggle"
        aria-expanded={open}
        aria-controls="reading-settings"
        // Named explicitly because the visible label is hidden on a phone, and
        // `display: none` removes text from the accessibility tree as well as
        // from the screen (SPEC009 T10).
        aria-label={words.readingSettings}
        title={words.readingSettings}
        onClick={() => setOpen((was) => !was)}
      >
        <Icon name="text" />
        <span className="ui-btn__label">{words.readingSettingsShort}</span>
      </button>

      <div className="reading-settings__panel" id="reading-settings" hidden={!open}>
        <Choice
          name="size"
          legend={words.textSize}
          options={TEXT_SIZES}
          labels={words.textSizeName}
          value={preferences.size}
          onChange={(value) => update('size', value)}
        />
        <Choice
          name="leading"
          legend={words.lineSpacing}
          options={TEXT_LEADINGS}
          labels={words.lineSpacingName}
          value={preferences.leading}
          onChange={(value) => update('leading', value)}
        />
        <Choice
          name="measure"
          legend={words.lineLength}
          options={TEXT_MEASURES}
          labels={words.lineLengthName}
          value={preferences.measure}
          onChange={(value) => update('measure', value)}
        />
        <Choice
          name="face"
          legend={words.typeface}
          options={TEXT_FACES}
          labels={words.typefaceName}
          value={preferences.face}
          onChange={(value) => update('face', value)}
        />
        <button type="button" className="reading-settings__reset" onClick={reset}>
          {words.resetToDefaults}
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
  name,
  legend,
  options,
  labels,
  value,
  onChange,
}: {
  /** Stable, and not derived from the legend: the legend is translated. */
  name: string;
  legend: string;
  options: T[];
  labels: Record<T, string>;
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <fieldset className="reading-settings__group">
      <legend>{legend}</legend>
      <div className="reading-settings__options">
        {options.map((option) => (
          <label key={option} className={option === value ? 'is-selected' : undefined}>
            <input
              type="radio"
              name={`reading-${name}`}
              value={option}
              checked={option === value}
              onChange={() => onChange(option)}
            />
            {labels[option]}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export type { ReadingPreferences };
