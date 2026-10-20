export interface ReferenceNode {
  path: string;
  number: string;
  san: string;
}

export type MoveReference =
  | { status: 'resolved'; path: string; line?: string }
  | { status: 'invalid' | 'missing' | 'ambiguous' | 'target' };

export function normalise(label: string): string;
export function resolveMoveReference(
  nodes: readonly ReferenceNode[],
  label: string,
  line?: string,
): MoveReference;
