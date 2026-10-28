/**
 * Branch handle ids.
 *
 * Edges are only ever created by the canvas, so the canvas owns the handle
 * names: a condition node renders `yes` / `no` and an AB split renders
 * `split-<index>`. The engine and the simulator used to emit `true` / `false`
 * and the split path name instead, so every branch they took looked for an edge
 * nobody had stored and the run stopped at the node.
 *
 * They now emit the canvas ids. The aliases below keep graphs saved under the
 * old convention — including template graphs seeded before the fix — working.
 */

/** Candidate edge handle ids for a branch, most specific first. */
export function branchHandleIds(
  handle: string,
  paths?: Array<{ name: string }>
): string[] {
  const ids = [handle];

  if (handle === "yes") ids.push("true");
  if (handle === "no") ids.push("false");
  if (handle === "true") ids.push("yes");
  if (handle === "false") ids.push("no");

  if (paths) {
    // Old graphs name an AB split branch after the path instead of its index.
    const index = paths.findIndex((p) => p.name === handle);
    if (index >= 0) ids.push(`split-${index}`);

    const byIndex = /^split-(\d+)$/.exec(handle);
    if (byIndex) {
      const name = paths[Number(byIndex[1])]?.name;
      if (name) ids.push(name);
    }
  }

  return ids;
}

/** The edge leaving `sourceId` through `handle`, trying the known aliases. */
export function findBranchEdge<
  E extends { source: string; sourceHandle?: string | null },
>(
  edges: E[],
  sourceId: string,
  handle: string,
  paths?: Array<{ name: string }>
): E | undefined {
  const outgoing = edges.filter((e) => e.source === sourceId);
  for (const id of branchHandleIds(handle, paths)) {
    const edge = outgoing.find((e) => (e.sourceHandle ?? undefined) === id);
    if (edge) return edge;
  }
  return undefined;
}
