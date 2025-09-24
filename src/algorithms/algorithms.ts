import type { NodeId } from '../types';

/**
 * Reachability via BFS.
 * Marks visited on enqueue and uses a pointer queue (no shift()).
 */
export function isReachable(
  from: NodeId,
  to: NodeId,
  getSuccessors: (node: NodeId) => NodeId[],
): boolean {
  if (from === to) return true;

  const seen = new Set<NodeId>([from]);
  const q: NodeId[] = [from];
  let head = 0;

  while (head < q.length) {
    const u = q[head++]!;
    for (const v of getSuccessors(u)) {
      if (seen.has(v)) continue;
      if (v === to) return true;
      seen.add(v);
      q.push(v);
    }
  }
  return false;
}

/**
 * Unweighted shortest path via BFS.
 * Robust to cycles; uses pointer queue; validates quickly if from===to.
 */
export function shortestPath(
  from: NodeId,
  to: NodeId,
  getSuccessors: (node: NodeId) => NodeId[],
): NodeId[] | null {
  if (from === to) return [from];

  const seen = new Set<NodeId>([from]);
  const parent = new Map<NodeId, NodeId>();
  const q: NodeId[] = [from];
  let head = 0;

  while (head < q.length) {
    const u = q[head++]!;
    for (const v of getSuccessors(u)) {
      if (seen.has(v)) continue;
      seen.add(v);
      parent.set(v, u);
      if (v === to) {
        // reconstruct
        const path: NodeId[] = [];
        let cur: NodeId | undefined = to;
        while (cur !== undefined) {
          path.unshift(cur);
          cur = parent.get(cur);
        }
        return path;
      }
      q.push(v);
    }
  }
  return null;
}

/**
 * Enumerate all simple paths (no repeated vertices) from `from` to `to`.
 * Depth is in edges. Negative maxDepth throws. Exponential in general.
 */
export function findAllPaths(
  from: NodeId,
  to: NodeId,
  getSuccessors: (node: NodeId) => NodeId[],
  maxDepth = 100,
): NodeId[][] {
  if (maxDepth < 0) {
    throw new Error('findAllPaths: maxDepth must be >= 0');
  }

  const paths: NodeId[][] = [];
  const visited = new Set<NodeId>([from]);

  function dfs(u: NodeId, path: NodeId[], depth: number): void {
    if (depth > maxDepth) return;
    if (u === to) {
      paths.push([...path]);
      return;
    }
    for (const v of getSuccessors(u)) {
      if (visited.has(v)) continue;
      visited.add(v);
      path.push(v);
      dfs(v, path, depth + 1);
      path.pop();
      visited.delete(v);
    }
  }

  dfs(from, [from], 0);
  return paths;
}

/**
 * Transitive closure via per-source BFS.
 * Returns nodes reachable by >=1 edge (non-reflexive), matching prior behavior.
 * Complexity: O(V*(V+E)) and better on sparse graphs than O(V^3).
 */
export function transitiveClosure(
  nodes: NodeId[],
  getSuccessors: (node: NodeId) => NodeId[],
): Map<NodeId, Set<NodeId>> {
  const closure = new Map<NodeId, Set<NodeId>>();

  for (const s of nodes) {
    const seen = new Set<NodeId>([s]);
    const reach = new Set<NodeId>();
    const q: NodeId[] = [s];
    let head = 0;

    while (head < q.length) {
      const u = q[head++]!;
      for (const v of getSuccessors(u)) {
        if (seen.has(v)) continue;
        seen.add(v);
        reach.add(v);
        q.push(v);
      }
    }
    closure.set(s, reach);
  }

  return closure;
}

/**
 * Longest path in a DAG.
 * Validates `topologicalOrder` covers all nodes and respects edges.
 * Returns a deterministic single-vertex path when no edges exist.
 */
export function longestPathDAG(
  nodes: NodeId[],
  getSuccessors: (node: NodeId) => NodeId[],
  topologicalOrder: NodeId[],
): { length: number; path: NodeId[] } {
  // Validate topological order
  const pos = new Map<NodeId, number>();
  for (let i = 0; i < topologicalOrder.length; i++) {
    const node = topologicalOrder[i];
    if (node === undefined) {
      throw new Error('longestPathDAG: topologicalOrder contains an undefined entry');
    }
    pos.set(node, i);
  }

  if (pos.size !== nodes.length) {
    throw new Error('longestPathDAG: topologicalOrder must include every node exactly once');
  }
  for (const u of nodes) {
    for (const v of getSuccessors(u)) {
      const pu = pos.get(u);
      const pv = pos.get(v);
      if (pu === undefined || pv === undefined) {
        throw new Error('longestPathDAG: topologicalOrder is missing nodes');
      }
      if (pu >= pv) {
        throw new Error('longestPathDAG: provided topologicalOrder is not valid for this graph (edge goes backward)');
      }
    }
  }

  const dist = new Map<NodeId, number>();
  const parent = new Map<NodeId, NodeId | null>();

  for (const u of topologicalOrder) {
    if (!dist.has(u)) {
      dist.set(u, 0);
      parent.set(u, null);
    }
    const du = dist.get(u)!;
    for (const v of getSuccessors(u)) {
      const cand = du + 1;
      if (!dist.has(v) || cand > dist.get(v)!) {
        dist.set(v, cand);
        parent.set(v, u);
      }
    }
  }

  // Choose best end node; tie-break by earliest position for determinism
  let end: NodeId | null = topologicalOrder[0] ?? null;
  let best = 0;
  if (end !== null) {
    best = dist.get(end) ?? 0;
  }
  for (const u of topologicalOrder) {
    const du = dist.get(u) ?? 0;
    if (du > best) {
      best = du;
      end = u;
    }
  }

  const path: NodeId[] = [];
  if (end !== null) {
    let cur: NodeId | null = end;
    while (cur !== null) {
      path.unshift(cur);
      cur = parent.get(cur) ?? null;
    }
  }

  return { length: best, path };
}

/**
 * Bipartiteness on the underlying undirected graph.
 * Self-loops immediately fail. Works across disconnected components.
 */
export function isBipartite(
  nodes: NodeId[],
  getSuccessors: (node: NodeId) => NodeId[],
): { isBipartite: boolean; partition?: [Set<NodeId>, Set<NodeId>] } {
  const color = new Map<NodeId, number>();
  const A = new Set<NodeId>();
  const B = new Set<NodeId>();

  // Precompute undirected neighbors (successors ∪ predecessors via reverse search by scanning successors)
  // To avoid O(V^2), we build a temporary neighbor map in O(V+E).
  const neighbors = new Map<NodeId, Set<NodeId>>();
  for (const u of nodes) neighbors.set(u, new Set<NodeId>());
  for (const u of nodes) {
    for (const v of getSuccessors(u)) {
      neighbors.get(u)!.add(v);
      neighbors.get(v)?.add(u); // treat as undirected
      if (u === v) return { isBipartite: false }; // self-loop invalidates bipartiteness
    }
  }

  for (const s of nodes) {
    if (color.has(s)) continue;
    color.set(s, 0); A.add(s);

    const q: NodeId[] = [s];
    let head = 0;

    while (head < q.length) {
      const u = q[head++]!;
      const cu = color.get(u)!;

      for (const v of neighbors.get(u)!) {
        if (!color.has(v)) {
          const cv = 1 - cu;
          color.set(v, cv);
          (cv === 0 ? A : B).add(v);
          q.push(v);
        } else if (color.get(v) === cu) {
          return { isBipartite: false };
        }
      }
    }
  }

  return { isBipartite: true, partition: [A, B] };
}
