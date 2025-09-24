/**
 * Core directed graph implementation with advanced graph theory algorithms
 */

import type {
  NodeId,
  EdgeId,
  Edge,
  Node,
  SCC,
  Cycle,
  EdgeType,
  GraphOptions,
  GraphAnalysis,
  CondensationGraph,
  CondensationComponent,
} from './types';

export class DirectedGraph<NodeMeta = unknown, EdgeMeta = unknown> {
  private nodes: Map<NodeId, Node<NodeMeta>>;
  private edges: Map<EdgeId, Edge<EdgeMeta>>;
  private adjacencyList: Map<NodeId, Set<NodeId>>;
  private reverseAdjacencyList: Map<NodeId, Set<NodeId>>;
  private edgeIndex: Map<string, Set<EdgeId>>;
  private nextEdgeId: number;
  private options: Required<GraphOptions>;

  constructor(options: GraphOptions = {}) {
    this.nodes = new Map();
    this.edges = new Map();
    this.adjacencyList = new Map();
    this.reverseAdjacencyList = new Map();
    this.edgeIndex = new Map();
    this.nextEdgeId = 0;
    this.options = {
      allowSelfLoops: options.allowSelfLoops ?? true,
      allowMultiEdges: options.allowMultiEdges ?? false,
      validateOnConstruction: options.validateOnConstruction ?? true,
    };
  }

  /**
   * Add a node to the graph
   */
  addNode(id: NodeId, metadata?: NodeMeta): void {
    if (this.nodes.has(id)) {
      throw new Error(`Node ${id} already exists`);
    }

    this.nodes.set(id, { id, metadata });
    this.adjacencyList.set(id, new Set());
    this.reverseAdjacencyList.set(id, new Set());
  }

  /**
   * Add an edge to the graph
   */
  addEdge(from: NodeId, to: NodeId, metadata?: EdgeMeta): EdgeId {
    if (!this.nodes.has(from)) {
      throw new Error(`Source node ${from} does not exist`);
    }
    if (!this.nodes.has(to)) {
      throw new Error(`Target node ${to} does not exist`);
    }

    if (!this.options.allowSelfLoops && from === to) {
      throw new Error(`Self-loop not allowed: ${from} -> ${to}`);
    }

    const edgeKey = this.getEdgeKey(from, to);
    if (!this.options.allowMultiEdges && this.edgeIndex.has(edgeKey)) {
      throw new Error(`Edge already exists: ${edgeKey}`);
    }

    const edgeId = this.options.allowMultiEdges
      ? `${edgeKey}#${this.nextEdgeId++}`
      : edgeKey;

    const edge: Edge<EdgeMeta> = {
      id: edgeId,
      from,
      to,
      metadata,
    };

    this.edges.set(edgeId, edge);
    let bucket = this.edgeIndex.get(edgeKey);
    if (!bucket) {
      bucket = new Set();
      this.edgeIndex.set(edgeKey, bucket);
    }
    bucket.add(edgeId);

    const fromAdj = this.adjacencyList.get(from);
    if (fromAdj) {
      fromAdj.add(to);
    }

    const toRev = this.reverseAdjacencyList.get(to);
    if (toRev) {
      toRev.add(from);
    }

    if (this.options.validateOnConstruction) {
      this.validateEdgeInvariants(from, to);
    }

    return edgeId;
  }

  /**
   * Get all nodes
   */
  getNodes(): Node<NodeMeta>[] {
    return Array.from(this.nodes.values());
  }

  /**
   * Get all edges
   */
  getEdges(): Edge<EdgeMeta>[] {
    return Array.from(this.edges.values());
  }

  /**
   * Get successors of a node
   */
  getSuccessors(nodeId: NodeId): NodeId[] {
    return Array.from(this.adjacencyList.get(nodeId) ?? []);
  }

  /**
   * Get successors of a node, throwing if it does not exist.
   */
  getSuccessorsStrict(nodeId: NodeId): NodeId[] {
    if (!this.nodes.has(nodeId)) {
      throw new Error(`Unknown node: ${nodeId}`);
    }
    return Array.from(this.adjacencyList.get(nodeId)!);
  }

  /**
   * Get predecessors of a node
   */
  getPredecessors(nodeId: NodeId): NodeId[] {
    return Array.from(this.reverseAdjacencyList.get(nodeId) ?? []);
  }

  /**
   * Get predecessors of a node, throwing if it does not exist.
   */
  getPredecessorsStrict(nodeId: NodeId): NodeId[] {
    if (!this.nodes.has(nodeId)) {
      throw new Error(`Unknown node: ${nodeId}`);
    }
    return Array.from(this.reverseAdjacencyList.get(nodeId)!);
  }

  /**
   * Check if the graph has a specific node
   */
  hasNode(nodeId: NodeId): boolean {
    return this.nodes.has(nodeId);
  }

  /**
   * Check if the graph has a specific edge
   */
  hasEdge(from: NodeId, to: NodeId): boolean {
    const edges = this.edgeIndex.get(this.getEdgeKey(from, to));
    return !!edges && edges.size > 0;
  }

  // Replace the old getEdgeKey with a collision-safe encoding.
  private getEdgeKey(from: NodeId, to: NodeId): string {
    // length-prefix to avoid ambiguity: "len(from):from|len(to):to"
    return `${from.length}:${from}|${to.length}:${to}`;
  }

  private validateEdgeInvariants(from: NodeId, to: NodeId): void {
    if (!this.adjacencyList.get(from)?.has(to)) {
      throw new Error(`Invariant broken: ${from} -> ${to} missing in adjacencyList`);
    }
    if (!this.reverseAdjacencyList.get(to)?.has(from)) {
      throw new Error(`Invariant broken: ${from} -> ${to} missing in reverseAdjacencyList`);
    }
  }

  private getEdgeIdsBetween(from: NodeId, to: NodeId): EdgeId[] {
    const key = this.getEdgeKey(from, to);
    return Array.from(this.edgeIndex.get(key) ?? []);
  }

  /**
   * Find strongly connected components using Tarjan's algorithm
   * Time complexity: O(V + E)
   */
  findSCCs(): SCC[] {
    const sccs: SCC[] = [];
    const index = new Map<NodeId, number>();
    const lowlink = new Map<NodeId, number>();
    const onStack = new Set<NodeId>();
    const stack: NodeId[] = [];
    let currentIndex = 0;

    const strongConnect = (nodeId: NodeId): void => {
      index.set(nodeId, currentIndex);
      lowlink.set(nodeId, currentIndex);
      currentIndex++;
      stack.push(nodeId);
      onStack.add(nodeId);

      const successors = this.getSuccessors(nodeId);
      for (const successor of successors) {
        if (!index.has(successor)) {
          strongConnect(successor);
          lowlink.set(nodeId, Math.min(
            lowlink.get(nodeId)!,
            lowlink.get(successor)!
          ));
        } else if (onStack.has(successor)) {
          lowlink.set(nodeId, Math.min(
            lowlink.get(nodeId)!,
            index.get(successor)!
          ));
        }
      }

      if (lowlink.get(nodeId) === index.get(nodeId)) {
        const sccNodes: NodeId[] = [];
        let w: NodeId;
        do {
          w = stack.pop()!;
          onStack.delete(w);
          sccNodes.push(w);
        } while (w !== nodeId);

        sccs.push({
          id: sccs.length,
          nodes: sccNodes,
          isAcyclic: sccNodes.length === 1 && !this.hasEdge(nodeId, nodeId),
        });
      }
    };

    for (const nodeId of this.nodes.keys()) {
      if (!index.has(nodeId)) {
        strongConnect(nodeId);
      }
    }

    return sccs;
  }

  /**
   * Perform topological sort using Kahn's algorithm.
   * Returns null if the graph has cycles.
   * Time complexity: O(V + E)
   */
  topologicalSort(): NodeId[] | null {
    const inDegree = new Map<NodeId, number>();
    const queue: NodeId[] = [];
    const result: NodeId[] = [];

    // Initialize in-degrees using reverseAdjacencyList sizes (O(V))
    for (const nodeId of this.nodes.keys()) {
      inDegree.set(nodeId, this.reverseAdjacencyList.get(nodeId)?.size ?? 0);
    }

    // Seed queue with all nodes of indegree 0
    for (const [nodeId, deg] of inDegree) {
      if (deg === 0) queue.push(nodeId);
    }

    // Pointer queue (no shift())
    let head = 0;
    while (head < queue.length) {
      const u = queue[head++]!;
      result.push(u);

      for (const v of this.adjacencyList.get(u) ?? []) {
        const nd = (inDegree.get(v) ?? 0) - 1;
        inDegree.set(v, nd);
        if (nd === 0) queue.push(v);
      }
    }

    return result.length === this.nodes.size ? result : null;
  }

  /**
   * Classify edges using DFS
   * Time complexity: O(V + E)
   */
  /**
 * Classify edges using DFS timestamps.
 * Edge types: 'tree', 'back', 'forward', 'cross'
 * Handles multi-edges deterministically: the first edge that discovers a vertex is 'tree';
 * additional parallel edges are classified after timestamps are known.
 */
  classifyEdges(): Map<EdgeId, EdgeType> {
    const type = new Map<EdgeId, EdgeType>();
    const disc = new Map<NodeId, number>();
    const fini = new Map<NodeId, number>();
    const parent = new Map<NodeId, NodeId | null>();
    const onStack = new Set<NodeId>();
    let time = 0;

    const classifyNonTree = (u: NodeId, v: NodeId, eid: EdgeId): void => {
      if (onStack.has(v)) {
        type.set(eid, 'back');
      } else {
        const du = disc.get(u)!;
        const dv = disc.get(v)!;
        const fu = fini.get(u);
        const fv = fini.get(v);
        const fuValue = fu ?? Number.POSITIVE_INFINITY;
        const fvValue = fv ?? Number.POSITIVE_INFINITY;
        // v is a descendant of u iff du < dv && fv < fu
        if (du < dv && fvValue < fuValue) {
          type.set(eid, 'forward');
        } else {
          /* c8 ignore start */
          let ancestor = parent.get(v) ?? null;
          let isDescendant = false;
          while (ancestor !== null) {
            if (ancestor === u) {
              isDescendant = true;
              break;
            }
            ancestor = parent.get(ancestor) ?? null;
          }
          type.set(eid, isDescendant ? 'forward' : 'cross');
          /* c8 ignore stop */
        }
      }
    };

    const dfs = (u: NodeId): void => {
      disc.set(u, time++);
      onStack.add(u);
      parent.set(u, parent.get(u) ?? null);

      for (const v of this.adjacencyList.get(u) ?? []) {
        const eids = this.getEdgeIdsBetween(u, v);
        if (eids.length === 0) continue; // defensive

        if (!disc.has(v)) {
          // First edge discovers v is the 'tree' edge
          const first = eids[0];
          if (first === undefined) continue;
          const rest = eids.slice(1);
          type.set(first, 'tree');
          parent.set(v, u);
          dfs(v);
          // Classify remaining parallel edges now that v has timestamps
          for (const eid of rest) classifyNonTree(u, v, eid);
        } else {
          // v already discovered -> classify every parallel edge
          for (const eid of eids) classifyNonTree(u, v, eid);
        }
      }

      onStack.delete(u);
      fini.set(u, time++);
    };

    for (const u of this.nodes.keys()) {
      if (!disc.has(u)) dfs(u);
    }
    for (const edge of this.edges.values()) {
      if (type.get(edge.id) === 'cross') {
        classifyNonTree(edge.from, edge.to, edge.id);
      }
    }
    return type;
  }

  /**
   * Find all cycles in the graph
   */
  findCycles(precomputed?: {
    sccs?: SCC[];
    edgeClassifications?: Map<EdgeId, EdgeType>;
  }): Cycle[] {
    const cycles: Cycle[] = [];
    const edgeClassification = precomputed?.edgeClassifications ?? this.classifyEdges();
    const sccs = precomputed?.sccs ?? this.findSCCs();

    for (const scc of sccs) {
      if (scc.isAcyclic) continue;

      const cycleEdges: EdgeId[] = [];
      const backEdges: EdgeId[] = [];

      // Collect all edges within the SCC
      for (const nodeId of scc.nodes) {
        for (const successor of this.getSuccessors(nodeId)) {
          if (scc.nodes.includes(successor)) {
            const edgeIds = this.getEdgeIdsBetween(nodeId, successor);
            for (const edgeId of edgeIds) {
              const edge = this.edges.get(edgeId);
              if (!edge) continue;
              cycleEdges.push(edge.id);
              const classification = edgeClassification.get(edge.id);
              if (classification === 'back') {
                backEdges.push(edge.id);
              }
            }
          }
        }
      }

      cycles.push({
        nodes: scc.nodes,
        edges: cycleEdges,
        backEdges,
      });
    }

    return cycles;
  }
  /**
   * Build condensation graph (DAG of SCCs) in O(E).
   * Each component collects entry/exit/internal/feedback edges.
   * Topological order computed via Kahn over component graph (dedup inter-component edges).
   */
  buildCondensationGraph(precomputed?: {
    sccs?: SCC[];
    edgeClassifications?: Map<EdgeId, EdgeType>;
  }): CondensationGraph {
    const sccs = precomputed?.sccs ?? this.findSCCs();
    const edgeClass = precomputed?.edgeClassifications ?? this.classifyEdges();

    // Map node -> component id
    const componentMap = new Map<NodeId, number>();
    for (const scc of sccs) {
      for (const n of scc.nodes) componentMap.set(n, scc.id);
    }

    // Prepare components
    const components: CondensationComponent[] = sccs.map(scc => ({
      id: scc.id,
      members: scc.nodes,
      isLoop: !scc.isAcyclic,
      entryEdges: [],
      exitEdges: [],
      internalEdges: [],
      feedbackEdges: [],
    }));
    const componentById = new Map<number, CondensationComponent>();
    for (const component of components) componentById.set(component.id, component);

    // Component adjacency for topo sort (dedup)
    const compAdj = new Map<number, Set<number>>();
    const indeg = new Map<number, number>();
    for (const { id } of components) {
      compAdj.set(id, new Set());
      indeg.set(id, 0);
    }

    // Single pass over edges
    for (const edge of this.edges.values()) {
      const cf = componentMap.get(edge.from);
      const ct = componentMap.get(edge.to);

      if (cf === undefined || ct === undefined) {
        throw new Error('buildCondensationGraph: encountered edge missing component mapping');
      }

      const fromComponent = componentById.get(cf);
      const toComponent = componentById.get(ct);

      if (!fromComponent || !toComponent) {
        throw new Error('buildCondensationGraph: component lookup failed');
      }

      if (cf === ct) {
        fromComponent.internalEdges.push(edge);
        if (edgeClass.get(edge.id) === 'back') {
          fromComponent.feedbackEdges.push(edge);
        }
      } else {
        fromComponent.exitEdges.push(edge);
        toComponent.entryEdges.push(edge);
        if (!compAdj.get(cf)!.has(ct)) {
          compAdj.get(cf)!.add(ct);
          indeg.set(ct, (indeg.get(ct) ?? 0) + 1);
        }
      }
    }

    // Kahn over components
    const order: number[] = [];
    const q: number[] = [];
    for (const [c, d] of indeg) if (d === 0) q.push(c);

    let head = 0;
    while (head < q.length) {
      const current = q[head];
      head++;
      if (current === undefined) continue;
      order.push(current);
      for (const nb of compAdj.get(current)!) {
        const nd = (indeg.get(nb) ?? 0) - 1;
        indeg.set(nb, nd);
        if (nd === 0) q.push(nb);
      }
    }

    return {
      components,
      componentMap,
      topologicalOrder: order,
    };
  }


  /**
  * Perform comprehensive graph analysis
  * (unchanged API; now relies on improved internals)
  */
  analyze(): GraphAnalysis {
    const sccs = this.findSCCs();
    const edgeClassifications = this.classifyEdges();
    const cycles = this.findCycles({ sccs, edgeClassifications });
    const topologicalOrder = this.topologicalSort();
    const isAcyclic = topologicalOrder !== null;
    const condensationGraph = this.buildCondensationGraph({ sccs, edgeClassifications });

    return {
      nodeCount: this.nodes.size,
      edgeCount: this.edges.size,
      isAcyclic,
      sccs,
      cycles,
      topologicalOrder,
      condensationGraph,
      edgeClassifications,
    };
  }

  /**
   * Clear the graph
   */
  clear(): void {
    this.nodes.clear();
    this.edges.clear();
    this.adjacencyList.clear();
    this.reverseAdjacencyList.clear();
    this.edgeIndex.clear();
    this.nextEdgeId = 0;
  }
}
