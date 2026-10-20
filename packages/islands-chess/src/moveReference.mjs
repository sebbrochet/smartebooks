/** Shared by the browser and the plain-Node content checker. */
export function normalise(label) {
  return label.replace(/[+#!?\s]+/g, '').toLowerCase();
}

function numberedMoves(line) {
  const moves = [];
  let rest = line.trim();
  let ply;
  while (rest) {
    const token =
      /^(?:(\d+)(\.{3}|\.)(?!\.)\s*)?((?:O-O(?:-O)?|[KQRBN]?[a-h]?[1-8]?x?[a-h][1-8](?:=[QRBN])?)[+#!?]*)(?=\s|$)/i.exec(
        rest,
      );
    if (!token) return undefined;
    if (token[1]) {
      const number = Number(token[1]);
      const explicit = (number - 1) * 2 + (token[2] === '...' ? 1 : 0);
      if (!Number.isSafeInteger(explicit) || explicit < 0) return undefined;
      if (ply !== undefined && explicit !== ply) return undefined;
      ply = explicit;
    }
    if (ply === undefined) return undefined;
    moves.push(normalise(`${Math.floor(ply / 2) + 1}${ply % 2 ? '...' : '.'}${token[3]}`));
    ply++;
    rest = rest.slice(token[0].length).trimStart();
  }
  return moves.length ? moves : undefined;
}

/**
 * `line` is a contiguous, numbered route, not another first-match hint.
 * Paths let both callers check ancestry without depending on a PGN parser.
 */
export function resolveMoveReference(nodes, label, line) {
  const wanted = normalise(label);
  const matches = (node) =>
    normalise(`${node.number}${node.san}`) === wanted || normalise(node.san) === wanted;

  if (line === undefined) {
    const node = wanted && nodes.find(matches);
    return node ? { status: 'resolved', path: node.path } : { status: 'missing' };
  }

  const moves = numberedMoves(line);
  if (!moves) return { status: 'invalid' };
  const byPath = new Map(nodes.map((node) => [node.path, node]));
  const routes = [];
  for (const end of nodes) {
    const route = [];
    let node = end;
    for (let index = moves.length - 1; index >= 0; index--) {
      if (!node || normalise(`${node.number}${node.san}`) !== moves[index]) break;
      route.unshift(node);
      const dot = node.path.lastIndexOf('.');
      node = byPath.get(dot < 0 ? '' : node.path.slice(0, dot));
    }
    if (route.length === moves.length) routes.push(route);
  }
  if (!routes.length) return { status: 'missing' };
  if (routes.length !== 1) return { status: 'ambiguous' };
  const route = routes[0];
  const targets = wanted ? route.filter(matches) : [];
  if (targets.length !== 1) return { status: 'target' };
  return { status: 'resolved', path: targets[0].path, line: route[route.length - 1].path };
}
