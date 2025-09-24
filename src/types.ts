/**
 * Core type definitions for the graph library
 */

/**
 * Unique identifier for a graph node
 */
export type NodeId = string;

/**
 * Unique identifier for a graph edge
 */
export type EdgeId = string;

/**
 * Types of edges as classified by DFS traversal
 */
export type EdgeType = 'tree' | 'back' | 'forward' | 'cross';

/**
 * Represents a directed edge in the graph
 */
export interface Edge<T = unknown> {
  id: EdgeId;
  from: NodeId;
  to: NodeId;
  metadata?: T;
}

/**
 * Represents a node in the graph
 */
export interface Node<T = unknown> {
  id: NodeId;
  metadata?: T;
}

/**
 * A strongly connected component in the graph
 */
export interface SCC {
  id: number;
  nodes: NodeId[];
  isAcyclic: boolean;
}

/**
 * Represents a cycle in the graph
 */
export interface Cycle {
  nodes: NodeId[];
  edges: EdgeId[];
  backEdges: EdgeId[];
}

/**
 * Component in a condensation graph (SCC collapsed to a single node)
 */
export interface CondensationComponent {
  id: number;
  members: NodeId[];
  isLoop: boolean;
  entryEdges: Edge[];
  exitEdges: Edge[];
  internalEdges: Edge[];
  feedbackEdges: Edge[];
}

/**
 * The condensation graph (DAG of SCCs)
 */
export interface CondensationGraph {
  components: CondensationComponent[];
  componentMap: Map<NodeId, number>;
  topologicalOrder: number[];
}

/**
 * Result of graph analysis
 */
export interface GraphAnalysis {
  nodeCount: number;
  edgeCount: number;
  isAcyclic: boolean;
  sccs: SCC[];
  cycles: Cycle[];
  topologicalOrder: NodeId[] | null;
  condensationGraph: CondensationGraph | null;
  edgeClassifications: Map<EdgeId, EdgeType>;
}

/**
 * Options for graph construction and analysis
 */
export interface GraphOptions {
  /**
   * Whether to allow self-loops (edges from a node to itself)
   */
  allowSelfLoops?: boolean;

  /**
   * Whether to allow multiple edges between the same pair of nodes
   */
  allowMultiEdges?: boolean;

  /**
   * Whether to validate the graph structure during construction
   */
  validateOnConstruction?: boolean;
}