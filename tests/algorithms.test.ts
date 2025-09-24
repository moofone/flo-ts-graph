import { describe, it, expect } from 'vitest';
import {
  DirectedGraph,
  isReachable,
  shortestPath,
  findAllPaths,
  transitiveClosure,
  longestPathDAG,
  isBipartite,
} from '../src';

describe('Graph Algorithms', () => {
  describe('isReachable', () => {
    it('should find reachable nodes', () => {
      const graph = new Map([
        ['A', ['B', 'C']],
        ['B', ['D']],
        ['C', ['D']],
        ['D', []],
      ]);

      const getSuccessors = (node: string): string[] => graph.get(node) ?? [];

      expect(isReachable('A', 'D', getSuccessors)).toBe(true);
      expect(isReachable('A', 'B', getSuccessors)).toBe(true);
      expect(isReachable('B', 'A', getSuccessors)).toBe(false);
      expect(isReachable('D', 'A', getSuccessors)).toBe(false);
    });

    it('should handle cycles', () => {
      const graph = new Map([
        ['A', ['B']],
        ['B', ['C']],
        ['C', ['A']],
      ]);

      const getSuccessors = (node: string): string[] => graph.get(node) ?? [];

      expect(isReachable('A', 'C', getSuccessors)).toBe(true);
      expect(isReachable('B', 'A', getSuccessors)).toBe(true);
      expect(isReachable('C', 'B', getSuccessors)).toBe(true);
    });

    it('should treat identical source and target as reachable', () => {
      const getSuccessors = (): string[] => [];

      expect(isReachable('A', 'A', getSuccessors)).toBe(true);
    });

    it('should terminate on cycles when target is absent', () => {
      const graph = new Map([
        ['A', ['B']],
        ['B', ['C']],
        ['C', ['A']],
      ]);

      const getSuccessors = (node: string): string[] => graph.get(node) ?? [];

      expect(isReachable('A', 'D', getSuccessors)).toBe(false);
    });
  });

  describe('shortestPath', () => {
    it('should find shortest path', () => {
      const graph = new Map([
        ['A', ['B', 'C']],
        ['B', ['D']],
        ['C', ['D']],
        ['D', ['E']],
        ['E', []],
      ]);

      const getSuccessors = (node: string): string[] => graph.get(node) ?? [];

      const path = shortestPath('A', 'E', getSuccessors);
      // Both A->B->D->E and A->C->D->E have same length, either is valid
      expect(path).toBeDefined();
      expect(path).toHaveLength(4);
      expect(path?.[0]).toBe('A');
      expect(path?.[3]).toBe('E');
    });

    it('should return null for unreachable nodes', () => {
      const graph = new Map([
        ['A', ['B']],
        ['B', []],
        ['C', ['D']],
        ['D', []],
      ]);

      const getSuccessors = (node: string): string[] => graph.get(node) ?? [];

      expect(shortestPath('A', 'D', getSuccessors)).toBeNull();
    });

    it('should return trivial path when start equals end', () => {
      const getSuccessors = (): string[] => [];

      expect(shortestPath('A', 'A', getSuccessors)).toEqual(['A']);
    });
  });

  describe('findAllPaths', () => {
    it('should find all simple paths', () => {
      const graph = new Map([
        ['A', ['B', 'C']],
        ['B', ['D']],
        ['C', ['D']],
        ['D', []],
      ]);

      const getSuccessors = (node: string): string[] => graph.get(node) ?? [];

      const paths = findAllPaths('A', 'D', getSuccessors);
      expect(paths).toHaveLength(2);
      expect(paths).toContainEqual(['A', 'B', 'D']);
      expect(paths).toContainEqual(['A', 'C', 'D']);
    });

    it('should handle cycles without infinite recursion', () => {
      const graph = new Map([
        ['A', ['B']],
        ['B', ['C']],
        ['C', ['A', 'D']],
        ['D', []],
      ]);

      const getSuccessors = (node: string): string[] => graph.get(node) ?? [];

      const paths = findAllPaths('A', 'D', getSuccessors, 10);
      expect(paths).toHaveLength(1);
      expect(paths[0]).toEqual(['A', 'B', 'C', 'D']);
    });

    it('should respect max depth limits', () => {
      const graph = new Map([
        ['A', ['B']],
        ['B', ['C']],
        ['C', ['D']],
        ['D', []],
      ]);

      const getSuccessors = (node: string): string[] => graph.get(node) ?? [];

      const paths = findAllPaths('A', 'D', getSuccessors, 1);
      expect(paths).toHaveLength(0);
    });

    it('should reject negative depth limits', () => {
      const getSuccessors = (): string[] => [];

      expect(() => findAllPaths('A', 'B', getSuccessors, -1)).toThrow(
        /maxDepth must be >= 0/,
      );
    });
  });

  describe('transitiveClosure', () => {
    it('should compute transitive closure', () => {
      const graph = new Map([
        ['A', ['B']],
        ['B', ['C']],
        ['C', ['D']],
        ['D', []],
      ]);

      const nodes = ['A', 'B', 'C', 'D'];
      const getSuccessors = (node: string): string[] => graph.get(node) ?? [];

      const closure = transitiveClosure(nodes, getSuccessors);

      expect(closure.get('A')).toEqual(new Set(['B', 'C', 'D']));
      expect(closure.get('B')).toEqual(new Set(['C', 'D']));
      expect(closure.get('C')).toEqual(new Set(['D']));
      expect(closure.get('D')).toEqual(new Set([]));
    });

    it('should handle cycles without duplicating nodes', () => {
      const graph = new Map([
        ['A', ['B']],
        ['B', ['A']],
      ]);

      const nodes = ['A', 'B'];
      const getSuccessors = (node: string): string[] => graph.get(node) ?? [];

      const closure = transitiveClosure(nodes, getSuccessors);

      expect(closure.get('A')).toEqual(new Set(['B']));
      expect(closure.get('B')).toEqual(new Set(['A']));
    });
  });

  describe('longestPathDAG', () => {
    it('should find longest path in DAG', () => {
      const graph = new Map([
        ['A', ['B', 'C']],
        ['B', ['D']],
        ['C', ['D']],
        ['D', ['E']],
        ['E', []],
      ]);

      const nodes = ['A', 'B', 'C', 'D', 'E'];
      const getSuccessors = (node: string): string[] => graph.get(node) ?? [];
      const topologicalOrder = ['A', 'B', 'C', 'D', 'E'];

      const result = longestPathDAG(nodes, getSuccessors, topologicalOrder);

      // The longest path is 3 edges (4 nodes)
      expect(result.length).toBe(3);
      expect(result.path).toHaveLength(4);
      expect(result.path[0]).toBe('A');
      expect(result.path[result.path.length - 1]).toBe('E');
    });

    it('should return empty path for empty graph', () => {
      const result = longestPathDAG([], () => [], []);

      expect(result.length).toBe(0);
      expect(result.path).toEqual([]);
    });

    it('should throw when topological order contains undefined entries', () => {
      const nodes = ['A'];
      const getSuccessors = (): string[] => [];
      const order = ['A', undefined as unknown as string];

      expect(() => longestPathDAG(nodes, getSuccessors, order)).toThrow(
        /contains an undefined entry/,
      );
    });

    it('should throw when topological order omits nodes', () => {
      const nodes = ['A', 'B'];
      const getSuccessors = (node: string): string[] => (node === 'A' ? ['B'] : []);
      const order = ['A'];

      expect(() => longestPathDAG(nodes, getSuccessors, order)).toThrow(
        /must include every node/,
      );
    });

    it('should throw when topological order is missing nodes referenced by edges', () => {
      const nodes = ['A', 'B'];
      const getSuccessors = (node: string): string[] => (node === 'B' ? ['C'] : ['B']);
      const order = ['A', 'B'];

      expect(() => longestPathDAG(nodes, getSuccessors, order)).toThrow(
        /topologicalOrder is missing nodes/,
      );
    });

    it('should throw when edges violate provided order', () => {
      const nodes = ['A', 'B'];
      const getSuccessors = (node: string): string[] => (node === 'A' ? ['B'] : []);
      const order = ['B', 'A'];

      expect(() => longestPathDAG(nodes, getSuccessors, order)).toThrow(
        /edge goes backward/,
      );
    });
  });

  describe('isBipartite', () => {
    it('should detect bipartite graph', () => {
      // Bipartite graph: can be colored with 2 colors
      const graph = new Map([
        ['A', ['B', 'D']],
        ['B', ['A', 'C']],
        ['C', ['B', 'D']],
        ['D', ['A', 'C']],
      ]);

      const nodes = ['A', 'B', 'C', 'D'];
      const getSuccessors = (node: string): string[] => graph.get(node) ?? [];

      const result = isBipartite(nodes, getSuccessors);
      expect(result.isBipartite).toBe(true);
      expect(result.partition).toBeDefined();

      const [set1, set2] = result.partition!;
      expect(set1.size + set2.size).toBe(4);

      // Check that no two nodes in the same set are connected
      for (const node of set1) {
        const successors = getSuccessors(node);
        for (const successor of successors) {
          expect(set1.has(successor)).toBe(false);
        }
      }
    });

    it('should detect non-bipartite graph', () => {
      // Triangle: not bipartite
      const graph = new Map([
        ['A', ['B', 'C']],
        ['B', ['A', 'C']],
        ['C', ['A', 'B']],
      ]);

      const nodes = ['A', 'B', 'C'];
      const getSuccessors = (node: string): string[] => graph.get(node) ?? [];

      const result = isBipartite(nodes, getSuccessors);
      expect(result.isBipartite).toBe(false);
      expect(result.partition).toBeUndefined();
    });

    it('should treat self-loops as non-bipartite', () => {
      const graph = new Map([
        ['A', ['A']],
      ]);

      const nodes = ['A'];
      const getSuccessors = (node: string): string[] => graph.get(node) ?? [];

      const result = isBipartite(nodes, getSuccessors);
      expect(result.isBipartite).toBe(false);
    });
  });

  describe('integration smoke', () => {
    it('should cover common workflows end-to-end', () => {
      const g = new DirectedGraph();
      ['A', 'B', 'C', 'D'].forEach(n => g.addNode(n));
      g.addEdge('A', 'B');
      g.addEdge('B', 'C');
      g.addEdge('A', 'D');

      const order = g.topologicalSort();
      expect(order).not.toBeNull();
      expect(order).toHaveLength(4);

      const lp = longestPathDAG(['A', 'B', 'C', 'D'], node => g.getSuccessors(node), order!);
      expect(lp.length).toBe(2);
      expect(lp.path[0]).toBe('A');
      expect(lp.path[lp.path.length - 1]).toBe('C');

      g.addNode('E');
      g.addEdge('C', 'E');
      g.addEdge('E', 'C');

      const analysis = g.analyze();
      expect(analysis.sccs.length).toBeGreaterThanOrEqual(2);
      expect(analysis.condensationGraph).not.toBeNull();
      expect(analysis.condensationGraph!.topologicalOrder.length).toBeGreaterThanOrEqual(2);

      const h = new DirectedGraph();
      ['1', '2', '3'].forEach(n => h.addNode(n));
      h.addEdge('1', '2');
      h.addEdge('2', '3');

      const bip = isBipartite(['1', '2', '3'], node => h.getSuccessors(node));
      expect(bip.isBipartite).toBe(true);

      expect(isReachable('A', 'C', node => g.getSuccessors(node))).toBe(true);
      expect(shortestPath('A', 'C', node => g.getSuccessors(node))).toEqual(['A', 'B', 'C']);
    });
  });
});
