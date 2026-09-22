import { useMessages } from '@smart-ebooks/engine';
import type { UpdateCheck } from './useServiceWorker';

/**
 * Ask whether there is a new version (SPEC003 E2.7).
 *
 * The button is the easy half. What the product could not say before is
 * *nothing is wrong* — a reader who saw no update strip had no way to tell a
 * current build from a broken update mechanism.
 *
 * Nothing is claimed here when an update is ready: `useServiceWorker` reports
 * `idle` in that case, so the strip is the only voice (QD6).
 */
export function UpdateCheck({ state, onCheck }: { state: UpdateCheck; onCheck: () => void }) {
  const words = useMessages();

  return (
    <div className="reader__update-check">
      <button
        type="button"
        className="reader__reset"
        onClick={onCheck}
        disabled={state === 'checking'}
      >
        {state === 'checking' ? words.updateChecking : words.updateCheck}
      </button>
      {state === 'current' && (
        <span className="reader__backup-status" role="status">
          {words.updateNone}
        </span>
      )}
      {state === 'failed' && (
        <span className="reader__backup-status" role="status">
          {words.updateCheckFailed}
        </span>
      )}
    </div>
  );
}
