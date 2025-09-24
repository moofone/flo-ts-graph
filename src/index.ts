/**
 * @flo/ts-graph - High-performance graph theory algorithms for TypeScript
 */

// Core graph implementation
export { DirectedGraph } from './graph';

// Type definitions
export type {
  NodeId,
  EdgeId,
  EdgeType,
  Edge,
  Node,
  SCC,
  Cycle,
  CondensationComponent,
  CondensationGraph,
  GraphAnalysis,
  GraphOptions,
} from './types';

// Algorithm utilities
export {
  isReachable,
  shortestPath,
  findAllPaths,
  transitiveClosure,
  longestPathDAG,
  isBipartite,
} from './algorithms/algorithms';

// Version
export const VERSION = '0.1.0';