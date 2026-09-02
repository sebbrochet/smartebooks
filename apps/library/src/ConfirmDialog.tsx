import { useEffect, useId, useRef, type ReactNode } from 'react';

interface ConfirmDialogProps {
  /** Names the action, and is what a screen reader announces on open. */
  title: string;
  /** What the reader is about to lose — and, as importantly, what they are not. */
  children: ReactNode;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * A modal confirmation for an action that cannot be undone from the UI.
 *
 * `alertdialog` rather than `dialog`: the role exists for exactly this — an
 * interruption that carries a consequence — and it makes assistive technology
 * announce the body text, not just the title, on open.
 *
 * Follows the house dialog shape from `SearchOverlay` (a scrim plus a panel,
 * rather than a native `<dialog>`) so both behave the same way, and because
 * `showModal` is patchy in the jsdom version the unit suite runs on.
 *
 * Three deliberate choices:
 *
 * - **Focus lands on Cancel.** The dialog appears under a cursor that has just
 *   clicked, and keyboards repeat. Whatever a stray Enter or double-click hits
 *   must be the harmless button; putting focus on the destructive one would
 *   reproduce the single-keystroke deletion this dialog exists to prevent.
 * - **Tab is trapped.** A modal whose focus can walk out into the page behind
 *   it is a modal only for people using a mouse.
 * - **Focus is restored with `preventScroll`.** `focus()` scrolls its target
 *   into view, which on a long shelf jumps the page after a cancel. This repo
 *   has been bitten by that three times; see `keepInView`.
 */
export function ConfirmDialog({
  title,
  children,
  confirmLabel,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const restoreFocusTo = useRef<Element | null>(null);
  const id = useId();

  useEffect(() => {
    // Captured before focus moves, so cancelling returns the reader to the
    // button they pressed rather than to the top of the shelf.
    restoreFocusTo.current = document.activeElement;
    cancelRef.current?.focus();

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = previousOverflow;
      (restoreFocusTo.current as HTMLElement | null)?.focus?.({ preventScroll: true });
    };
  }, []);

  function onKeyDown(event: React.KeyboardEvent) {
    if (event.key === 'Escape') {
      event.preventDefault();
      onCancel();
      return;
    }
    if (event.key !== 'Tab') return;

    // Only ever two buttons, but read from the DOM rather than assumed, so the
    // trap survives someone adding a third.
    const focusable = [...(panelRef.current?.querySelectorAll('button') ?? [])];
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const active = document.activeElement;

    if (event.shiftKey && active === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    }
  }

  return (
    // The handler sits on the container so it catches keys from either button.
    <div className="confirm" onKeyDown={onKeyDown}>
      <div className="confirm__scrim" aria-hidden="true" onClick={onCancel} />
      <div
        ref={panelRef}
        className="confirm__panel"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={`${id}-title`}
        aria-describedby={`${id}-body`}
      >
        <h2 id={`${id}-title`} className="confirm__title">
          {title}
        </h2>
        <div id={`${id}-body`} className="confirm__body">
          {children}
        </div>
        <div className="confirm__actions">
          <button type="button" ref={cancelRef} className="confirm__cancel" onClick={onCancel}>
            Cancel
          </button>
          <button type="button" className="confirm__confirm" onClick={onConfirm}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
