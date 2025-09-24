import { describe, it, expect, beforeEach } from 'vitest';
import { DirectedGraph } from '../src/graph';
import type { SCC } from '../src/types';

const edgeKey = (from: string, to: string): string => `${from.length}:${from}|${to.length}:${to}`;

describe('DirectedGraph', () => {
  let graph: DirectedGraph;

  beforeEach(() => {
    graph = new DirectedGraph();
  });

  describe('Basic Operations', () => {
    it('should add nodes', () => {
      graph.addNode('A');
      graph.addNode('B');
      graph.addNode('C');

      expect(graph.getNodes()).toHaveLength(3);
      expect(graph.hasNode('A')).toBe(true);
      expect(graph.hasNode('D')).toBe(false);
    });

    it('should prevent duplicate nodes', () => {
      graph.addNode('A');
      expect(() => graph.addNode('A')).toThrow('Node A already exists');
    });

    it('should add edges', () => {
      graph.addNode('A');
      graph.addNode('B');
      const edgeId = graph.addEdge('A', 'B');

      expect(graph.getEdges()).toHaveLength(1);
      expect(graph.hasEdge('A', 'B')).toBe(true);
      expect(graph.hasEdge('B', 'A')).toBe(false);
      expect(edgeId).toBe(edgeKey('A', 'B'));
    });

    it('should throw when adding an edge with unknown source', () => {
      graph.addNode('B');

      expect(() => graph.addEdge('A', 'B')).toThrow('Source node A does not exist');
    });

    it('should throw when adding an edge with unknown target', () => {
      graph.addNode('A');

      expect(() => graph.addEdge('A', 'B')).toThrow('Target node B does not exist');
    });

    it('should prevent duplicate edges when multi-edges are disabled', () => {
      graph.addNode('A');
      graph.addNode('B');
      graph.addEdge('A', 'B');

      expect(() => graph.addEdge('A', 'B')).toThrow(/Edge already exists/);
    });

    it('should handle self-loops when allowed', () => {
      graph.addNode('A');
      const edgeId = graph.addEdge('A', 'A');

      expect(edgeId).toBe(edgeKey('A', 'A'));
      expect(graph.hasEdge('A', 'A')).toBe(true);
    });

    it('should prevent self-loops when not allowed', () => {
      graph = new DirectedGraph({ allowSelfLoops: false });
      graph.addNode('A');

      expect(() => graph.addEdge('A', 'A')).toThrow('Self-loop not allowed');
    });

    it('should get successors and predecessors', () => {
      graph.addNode('A');
      graph.addNode('B');
      graph.addNode('C');
      graph.addEdge('A', 'B');
      graph.addEdge('A', 'C');
      graph.addEdge('B', 'C');

      expect(graph.getSuccessors('A')).toEqual(['B', 'C']);
      expect(graph.getSuccessors('B')).toEqual(['C']);
      expect(graph.getSuccessors('C')).toEqual([]);

      expect(graph.getPredecessors('A')).toEqual([]);
      expect(graph.getPredecessors('B')).toEqual(['A']);
      expect(graph.getPredecessors('C')).toEqual(['A', 'B']);
    });

    it('should return empty arrays for unknown nodes via non-strict accessors', () => {
      graph.addNode('A');

      expect(graph.getSuccessors('missing')).toEqual([]);
      expect(graph.getPredecessors('missing')).toEqual([]);
    });

    it('should provide strict successor and predecessor lookups', () => {
      graph.addNode('A');
      graph.addNode('B');
      graph.addEdge('A', 'B');

      expect(() => graph.getSuccessorsStrict('Z')).toThrow('Unknown node: Z');
      expect(() => graph.getPredecessorsStrict('Z')).toThrow('Unknown node: Z');
      expect(graph.getSuccessorsStrict('A')).toEqual(['B']);
      expect(graph.getPredecessorsStrict('B')).toEqual(['A']);
    });
  });

  describe('Robustness', () => {
    it('should detect invariant breaks when validation is enabled', () => {
      graph.addNode('A');
      graph.addNode('B');
      // @ts-expect-error reaching into private state for fault injection
      graph['adjacencyList'].delete('A');

      expect(() => graph.addEdge('A', 'B')).toThrow(/Invariant broken/);
    });

    it('can skip invariant checks when validation is disabled', () => {
      const relaxed = new DirectedGraph({ validateOnConstruction: false });
      relaxed.addNode('A');
      relaxed.addNode('B');
      // @ts-expect-error reaching into private state for fault injection
      relaxed['adjacencyList'].delete('A');

      expect(() => relaxed.addEdge('A', 'B')).not.toThrow();
    });

    it('should detect missing reverse adjacency entries', () => {
      graph.addNode('A');
      graph.addNode('B');
      // Remove reverse adjacency bucket so validation fails after edge insertion
      // @ts-expect-error reaching into private state for fault injection
      graph['reverseAdjacencyList'].delete('B');

      expect(() => graph.addEdge('A', 'B')).toThrow(/reverseAdjacencyList/);
    });
  });

  describe('Topological Sort', () => {
    it('should sort acyclic graph', () => {
      graph.addNode('A');
      graph.addNode('B');
      graph.addNode('C');
      graph.addNode('D');
      graph.addEdge('A', 'B');
      graph.addEdge('A', 'C');
      graph.addEdge('B', 'D');
      graph.addEdge('C', 'D');

      const sorted = graph.topologicalSort();
      expect(sorted).not.toBeNull();
      expect(sorted).toHaveLength(4);

      // A should come before B and C
      // B and C should come before D
      const indexA = sorted!.indexOf('A');
      const indexB = sorted!.indexOf('B');
      const indexC = sorted!.indexOf('C');
      const indexD = sorted!.indexOf('D');

      expect(indexA).toBeLessThan(indexB);
      expect(indexA).toBeLessThan(indexC);
      expect(indexB).toBeLessThan(indexD);
      expect(indexC).toBeLessThan(indexD);
    });

    it('should return null for cyclic graph', () => {
      graph.addNode('A');
      graph.addNode('B');
      graph.addNode('C');
      graph.addEdge('A', 'B');
      graph.addEdge('B', 'C');
      graph.addEdge('C', 'A'); // Creates a cycle

      const sorted = graph.topologicalSort();
      expect(sorted).toBeNull();
    });

    it('should treat missing reverse adjacency buckets as zero indegree', () => {
      graph.addNode('A');
      graph.addNode('B');
      graph.addEdge('A', 'B');
      // @ts-expect-error intentional invariant break for coverage
      graph['reverseAdjacencyList'].delete('B');

      const sorted = graph.topologicalSort();
      expect(sorted).toEqual(expect.arrayContaining(['A', 'B']));
    });

    it('should degrade gracefully when adjacency buckets are missing', () => {
      graph.addNode('A');
      graph.addNode('B');
      graph.addEdge('A', 'B');
      // @ts-expect-error intentional invariant break for coverage
      graph['adjacencyList'].delete('A');

      const sorted = graph.topologicalSort();
      expect(sorted).toBeNull();
    });

    it('should ignore edges to unknown nodes when sorting', () => {
      graph.addNode('A');
      graph.addNode('B');
      graph.addEdge('A', 'B');
      // Inject ghost neighbor to trigger fallback path
      // @ts-expect-error intentional invariant break for coverage
      graph['adjacencyList'].get('A')!.add('ghost');

      const sorted = graph.topologicalSort();
      expect(sorted).toEqual(['A', 'B']);
    });
  });

  describe('Strongly Connected Components', () => {
    it('should find SCCs in acyclic graph', () => {
      graph.addNode('A');
      graph.addNode('B');
      graph.addNode('C');
      graph.addEdge('A', 'B');
      graph.addEdge('B', 'C');

      const sccs = graph.findSCCs();
      expect(sccs).toHaveLength(3);
      sccs.forEach(scc => {
        expect(scc.nodes).toHaveLength(1);
        expect(scc.isAcyclic).toBe(true);
      });
    });

    it('should find SCCs in cyclic graph', () => {
      graph.addNode('A');
      graph.addNode('B');
      graph.addNode('C');
      graph.addNode('D');
      graph.addEdge('A', 'B');
      graph.addEdge('B', 'C');
      graph.addEdge('C', 'A'); // Cycle: A -> B -> C -> A
      graph.addEdge('C', 'D');

      const sccs = graph.findSCCs();
      expect(sccs).toHaveLength(2);

      const cyclicSCC = sccs.find(scc => scc.nodes.length > 1);
      expect(cyclicSCC).toBeDefined();
      expect(cyclicSCC!.nodes).toHaveLength(3);
      expect(cyclicSCC!.isAcyclic).toBe(false);

      const acyclicSCC = sccs.find(scc => scc.nodes.includes('D'));
      expect(acyclicSCC).toBeDefined();
      expect(acyclicSCC!.nodes).toEqual(['D']);
      expect(acyclicSCC!.isAcyclic).toBe(true);
    });
  });

  describe('Edge Classification', () => {
    it('should classify edges in acyclic graph', () => {
      graph.addNode('A');
      graph.addNode('B');
      graph.addNode('C');
      graph.addNode('D');
      graph.addEdge('A', 'B');
      graph.addEdge('A', 'C');
      graph.addEdge('B', 'D');
      graph.addEdge('C', 'D');

      const classification = graph.classifyEdges();
      expect(classification.get(edgeKey('A', 'B'))).toBe('tree');
      expect(classification.get(edgeKey('A', 'C'))).toBe('tree');
      expect(classification.get(edgeKey('B', 'D'))).toBe('tree');
      // C->D could be tree or cross depending on DFS order
    });

    it('should identify back edges in cycles', () => {
      graph.addNode('A');
      graph.addNode('B');
      graph.addNode('C');
      graph.addEdge('A', 'B');
      graph.addEdge('B', 'C');
      graph.addEdge('C', 'A'); // Back edge

      const classification = graph.classifyEdges();
      const backEdges = Array.from(classification.entries())
        .filter(([_, type]) => type === 'back')
        .map(([edge, _]) => edge);

      expect(backEdges).toHaveLength(1);
      expect(backEdges[0]).toBe(edgeKey('C', 'A'));
    });

    it('should classify forward and cross edges in branching structures', () => {
      graph.addNode('A');
      graph.addNode('B');
      graph.addNode('C');
      graph.addNode('D');
      graph.addNode('E');
      graph.addNode('F');

      graph.addEdge('A', 'B');
      graph.addEdge('B', 'E');
      graph.addEdge('A', 'C');
      graph.addEdge('C', 'D');
      graph.addEdge('C', 'F');
      graph.addEdge('F', 'E');
      graph.addEdge('A', 'D');

      const classification = graph.classifyEdges();

      expect(classification.get(edgeKey('A', 'D'))).toBe('forward');
      expect(classification.get(edgeKey('F', 'E'))).toBe('cross');
    });

    it('should skip edges when index buckets are missing', () => {
      graph.addNode('A');
      graph.addNode('B');
      graph.addEdge('A', 'B');

      const key = edgeKey('A', 'B');
      // @ts-expect-error intentional invariant break for coverage
      graph['edgeIndex'].delete(key);

      const classification = graph.classifyEdges();
      expect(classification.size).toBe(0);
    });

    it('should ignore undefined entries in edge buckets', () => {
      graph.addNode('A');
      graph.addNode('B');
      graph.addEdge('A', 'B');

      const key = edgeKey('A', 'B');
      // @ts-expect-error intentional invariant break for coverage
      graph['edgeIndex'].set(key, new Set([undefined as unknown as string]));

      const classification = graph.classifyEdges();
      expect(classification.size).toBe(0);
    });
  });

  describe('Cycle Detection', () => {
    it('should find no cycles in acyclic graph', () => {
      graph.addNode('A');
      graph.addNode('B');
      graph.addNode('C');
      graph.addEdge('A', 'B');
      graph.addEdge('B', 'C');

      const cycles = graph.findCycles();
      expect(cycles).toHaveLength(0);
    });

    it('should find simple cycle', () => {
      graph.addNode('A');
      graph.addNode('B');
      graph.addNode('C');
      graph.addEdge('A', 'B');
      graph.addEdge('B', 'C');
      graph.addEdge('C', 'A');

      const cycles = graph.findCycles();
      expect(cycles).toHaveLength(1);
      expect(cycles[0].nodes).toHaveLength(3);
      expect(cycles[0].edges).toHaveLength(3);
      expect(cycles[0].backEdges).toHaveLength(1);
    });

    it('should find multiple cycles', () => {
      graph.addNode('A');
      graph.addNode('B');
      graph.addNode('C');
      graph.addNode('D');
      graph.addNode('E');

      // First cycle: A -> B -> C -> A
      graph.addEdge('A', 'B');
      graph.addEdge('B', 'C');
      graph.addEdge('C', 'A');

      // Second cycle: D -> E -> D
      graph.addEdge('D', 'E');
      graph.addEdge('E', 'D');

      const cycles = graph.findCycles();
      expect(cycles).toHaveLength(2);
    });

    it('should skip edges missing from storage when collecting cycles', () => {
      graph.addNode('A');
      graph.addNode('B');
      graph.addNode('C');

      const edgeAB = graph.addEdge('A', 'B');
      graph.addEdge('B', 'C');
      graph.addEdge('C', 'A');

      // Remove the edge object to trigger defensive branch
      // @ts-expect-error intentional invariant break for coverage
      graph['edges'].delete(edgeAB);

      const cycles = graph.findCycles();
      expect(cycles).toHaveLength(1);
      expect(cycles[0].edges).not.toContain(edgeAB);
    });
  });

  describe('Condensation Graph', () => {
    it('should build condensation graph', () => {
      graph.addNode('A');
      graph.addNode('B');
      graph.addNode('C');
      graph.addNode('D');
      graph.addEdge('A', 'B');
      graph.addEdge('B', 'C');
      graph.addEdge('C', 'A'); // Cycle: A-B-C
      graph.addEdge('C', 'D');

      const condensation = graph.buildCondensationGraph();

      expect(condensation.components).toHaveLength(2);

      const loopComponent = condensation.components.find(c => c.isLoop);
      expect(loopComponent).toBeDefined();
      expect(loopComponent!.members).toHaveLength(3);
      expect(loopComponent!.feedbackEdges).toHaveLength(1);

      const singletonComponent = condensation.components.find(c => c.members.includes('D'));
      expect(singletonComponent).toBeDefined();
      expect(singletonComponent!.isLoop).toBe(false);
      expect(singletonComponent!.members).toEqual(['D']);
    });

    it('should compute topological order of components', () => {
      graph.addNode('A');
      graph.addNode('B');
      graph.addNode('C');
      graph.addNode('D');
      graph.addNode('E');

      // First SCC: A-B (cycle)
      graph.addEdge('A', 'B');
      graph.addEdge('B', 'A');

      // Second SCC: C (singleton)
      graph.addEdge('B', 'C');

      // Third SCC: D-E (cycle)
      graph.addEdge('C', 'D');
      graph.addEdge('D', 'E');
      graph.addEdge('E', 'D');

      const condensation = graph.buildCondensationGraph();
      expect(condensation.topologicalOrder).toHaveLength(3);

      // The SCC containing A-B should come before C
      // C should come before D-E
      const abComponent = condensation.components.find(c =>
        c.members.includes('A') && c.members.includes('B'));
      const cComponent = condensation.components.find(c =>
        c.members.includes('C'));
      const deComponent = condensation.components.find(c =>
        c.members.includes('D') && c.members.includes('E'));

      expect(abComponent).toBeDefined();
      expect(cComponent).toBeDefined();
      expect(deComponent).toBeDefined();

      const abIndex = condensation.topologicalOrder.indexOf(abComponent!.id);
      const cIndex = condensation.topologicalOrder.indexOf(cComponent!.id);
      const deIndex = condensation.topologicalOrder.indexOf(deComponent!.id);

      expect(abIndex).toBeLessThan(cIndex);
      expect(cIndex).toBeLessThan(deIndex);
    });

    it('throws when component mapping is incomplete', () => {
      graph.addNode('A');
      graph.addNode('B');
      graph.addEdge('A', 'B');

      const invalidSccs: SCC[] = [{ id: 0, nodes: ['A'], isAcyclic: true }];

      expect(() =>
        graph.buildCondensationGraph({
          sccs: invalidSccs,
          edgeClassifications: graph.classifyEdges(),
        }),
      ).toThrow(/encountered edge missing component mapping/);
    });

    it('throws when component lookup fails', () => {
      graph.addNode('A');
      graph.addNode('B');
      graph.addEdge('A', 'B');
      graph.addEdge('B', 'A');

      const sneakySccBase: { nodes: string[]; isAcyclic: boolean } = {
        nodes: ['A', 'B'],
        isAcyclic: false,
      };
      let idCalls = 0;

      Object.defineProperty(sneakySccBase, 'id', {
        configurable: true,
        get(): number {
          idCalls += 1;
          return idCalls <= sneakySccBase.nodes.length ? 0 : 99;
        },
      });

      const sneakyScc = sneakySccBase as unknown as SCC;

      expect(() =>
        graph.buildCondensationGraph({
          sccs: [sneakyScc],
          edgeClassifications: graph.classifyEdges(),
        }),
      ).toThrow(/component lookup failed/);
    });

    it('deduplicates inter-component edges', () => {
      graph.addNode('A');
      graph.addNode('B');
      graph.addNode('C');

      graph.addEdge('A', 'B');
      graph.addEdge('B', 'A');
      graph.addEdge('A', 'C');
      graph.addEdge('B', 'C');

      const condensation = graph.buildCondensationGraph();
      const abComponent = condensation.components.find(c =>
        c.members.includes('A') && c.members.includes('B'));
      const cComponent = condensation.components.find(c => c.members.includes('C'));

      expect(abComponent).toBeDefined();
      expect(cComponent).toBeDefined();
      expect(condensation.topologicalOrder).toEqual([abComponent!.id, cComponent!.id]);
    });

    it('ignores undefined component identifiers in the processing queue', () => {
      graph.addNode('Z');

      const invalidScc = {
        id: undefined as unknown as number,
        nodes: ['Z'],
        isAcyclic: true,
      } satisfies SCC;

      const result = graph.buildCondensationGraph({
        sccs: [invalidScc],
        edgeClassifications: new Map(),
      });

      expect(result.components).toHaveLength(1);
      expect(result.topologicalOrder).toEqual([]);
    });
  });

  describe('Graph Analysis', () => {
    it('should provide comprehensive analysis', () => {
      graph.addNode('A');
      graph.addNode('B');
      graph.addNode('C');
      graph.addEdge('A', 'B');
      graph.addEdge('B', 'C');
      graph.addEdge('C', 'A');

      const analysis = graph.analyze();

      expect(analysis.nodeCount).toBe(3);
      expect(analysis.edgeCount).toBe(3);
      expect(analysis.isAcyclic).toBe(false);
      expect(analysis.sccs).toHaveLength(1);
      expect(analysis.cycles).toHaveLength(1);
      expect(analysis.topologicalOrder).toBeNull();
      expect(analysis.condensationGraph).toBeDefined();
      expect(analysis.edgeClassifications.size).toBe(3);
    });
  });

  describe('Multi-edge Support', () => {
    it('should retain distinct parallel edges when enabled', () => {
      graph = new DirectedGraph({ allowMultiEdges: true });
      graph.addNode('A');
      graph.addNode('B');

      const firstEdge = graph.addEdge('A', 'B');
      const secondEdge = graph.addEdge('A', 'B');

      expect(firstEdge).not.toBe(secondEdge);
      const edges = graph.getEdges().filter(edge => edge.from === 'A' && edge.to === 'B');
      expect(edges).toHaveLength(2);
      expect(graph.hasEdge('A', 'B')).toBe(true);

      const classifications = graph.classifyEdges();
      expect(classifications.has(firstEdge)).toBe(true);
      expect(classifications.has(secondEdge)).toBe(true);
    });

    it('should include all parallel edges in cycle detection and analysis', () => {
      graph = new DirectedGraph({ allowMultiEdges: true });
      graph.addNode('A');
      graph.addNode('B');
      graph.addNode('C');

      const edgeAB = graph.addEdge('A', 'B');
      const edgeBC1 = graph.addEdge('B', 'C');
      const edgeBC2 = graph.addEdge('B', 'C');
      const edgeCA = graph.addEdge('C', 'A');

      const cycles = graph.findCycles();
      expect(cycles).toHaveLength(1);
      expect(cycles[0].edges).toEqual(
        expect.arrayContaining([edgeAB, edgeBC1, edgeBC2, edgeCA]),
      );

      const analysis = graph.analyze();
      expect(analysis.edgeCount).toBe(4);
      expect(analysis.cycles).toHaveLength(1);
      expect(analysis.cycles[0].edges).toEqual(
        expect.arrayContaining([edgeAB, edgeBC1, edgeBC2, edgeCA]),
      );
      expect(analysis.edgeClassifications.size).toBe(4);
    });
  });

  describe('Maintenance', () => {
    it('clears all internal state', () => {
      graph.addNode('A');
      graph.addNode('B');
      const initialEdge = graph.addEdge('A', 'B');
      expect(initialEdge).toBe(edgeKey('A', 'B'));

      graph.clear();

      expect(graph.getNodes()).toEqual([]);
      expect(graph.getEdges()).toEqual([]);

      graph.addNode('A');
      graph.addNode('B');
      const resetEdge = graph.addEdge('A', 'B');
      expect(resetEdge).toBe(edgeKey('A', 'B'));
    });
  });
});
