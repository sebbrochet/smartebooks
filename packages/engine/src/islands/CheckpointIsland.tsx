import type { IslandComponentProps } from '../types';
import type { CheckpointState } from '../store/store';
import { usePersistentState } from '../store/usePersistentState';
import { attrText } from './attributes';

type State = CheckpointState;

/**
 * A "mark as complete" checkpoint. Feeds the reader's progress and persists
 * its completion flag locally.
 */
export function CheckpointIsland({ id, attributes }: IslandComponentProps) {
  const label = attrText(attributes.label, 'Mark this section as complete');
  const [state, setState, loaded] = usePersistentState<State>(`progress:${id}`, {
    complete: false,
  });

  return (
    <label className={`island island--checkpoint ${state.complete ? 'is-complete' : ''}`}>
      <input
        type="checkbox"
        checked={state.complete}
        disabled={!loaded}
        onChange={(e) => setState({ complete: e.target.checked, at: Date.now() })}
      />
      <span>{label}</span>
    </label>
  );
}
