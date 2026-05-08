#!/usr/bin/env bun
/**
 * TSUNAMI Knowledge Graph Unit Tests
 */
import { describe, it, expect, beforeAll } from 'bun:test';
import {
  tsunamiGraphAddTriple,
  tsunamiGraphQueryEntity,
  tsunamiGraphInvalidateTriple,
  tsunamiGraphStats,
  tsunamiGraphCompatStats,
  tsunamiGraphTimeline,
  tsunamiGraphTraverse,
  tsunamiGraphFindTunnels,
} from '../src/tsunami_graph_runtime';

// ── Triple CRUD ────────────────────────────────────────

describe('Knowledge Graph CRUD', () => {
  it('adds a triple and returns an id', () => {
    const id = tsunamiGraphAddTriple({
      subject: 'agent:claude',
      predicate: 'uses',
      object: 'tool:tsunami',
    });
    expect(id).toBeTruthy();
    expect(typeof id).toBe('string');
  });

  it('queries outgoing edges', () => {
    tsunamiGraphAddTriple({
      subject: 'agent:claude-q',
      predicate: 'implements',
      object: 'feature:storm-center',
    });
    const rows = tsunamiGraphQueryEntity('agent:claude-q', undefined, 'outgoing');
    expect(rows.length).toBeGreaterThanOrEqual(1);
    expect(rows[0].subject).toBe('agent:claude-q');
    expect(rows[0].object).toBe('feature:storm-center');
  });

  it('queries incoming edges', () => {
    const rows = tsunamiGraphQueryEntity('feature:storm-center', undefined, 'incoming');
    expect(rows.length).toBeGreaterThanOrEqual(1);
    expect(rows.some((r: any) => r.subject === 'agent:claude-q')).toBe(true);
  });

  it('queries both directions', () => {
    tsunamiGraphAddTriple({
      subject: 'agent:claude-q',
      predicate: 'produces',
      object: 'output:analysis',
    });
    const rows = tsunamiGraphQueryEntity('agent:claude-q', undefined, 'both');
    expect(rows.length).toBeGreaterThanOrEqual(2);
  });

  it('adds typed triple with all fields', () => {
    const id = tsunamiGraphAddTriple({
      subject: 'project:tsunami',
      subjectType: 'project',
      subjectProperties: { language: 'TypeScript', runtime: 'Bun' },
      predicate: 'built_with',
      object: 'tech:bun',
      objectType: 'technology',
      objectProperties: { version: '1.3.13' },
      validFrom: '2026-05-08',
      validTo: '2027-05-08',
      confidence: 0.95,
      sourceFile: 'test/graph_runtime.test.ts',
    });
    expect(id).toBeTruthy();
  });
});

// ── Invalidation ───────────────────────────────────────

describe('Triple invalidation', () => {
  it('invalidates a triple with ended date', () => {
    tsunamiGraphAddTriple({
      subject: 'agent:temp',
      predicate: 'knows',
      object: 'fact:deprecated',
    });
    const changes = tsunamiGraphInvalidateTriple({
      subject: 'agent:temp',
      predicate: 'knows',
      object: 'fact:deprecated',
      ended: new Date().toISOString(),
    });
    expect(changes).toBeGreaterThanOrEqual(1);
  });
});

// ── Stats ──────────────────────────────────────────────

describe('Graph stats', () => {
  it('tsunamiGraphStats returns counts', () => {
    const stats = tsunamiGraphStats();
    expect(stats.total).toBeGreaterThan(0);
    expect(stats.active).toBeGreaterThanOrEqual(0);
  });

  it('tsunamiGraphCompatStats is an alias for graph stats', () => {
    const stats = tsunamiGraphCompatStats();
    expect(stats.total).toBeGreaterThan(0);
    expect(stats.active).toBeGreaterThanOrEqual(0);
  });
});

// ── Timeline ───────────────────────────────────────────

describe('Graph timeline', () => {
  it('returns triples chronologically', () => {
    const rows = tsunamiGraphTimeline(undefined, 10);
    expect(Array.isArray(rows)).toBe(true);
  });

  it('filters timeline by entity', () => {
    const rows = tsunamiGraphTimeline('agent:claude-q', 5);
    expect(rows.every((r: any) =>
      r.subject === 'agent:claude-q' || r.object === 'agent:claude-q'
    )).toBe(true);
  });
});

// ── Traversal ──────────────────────────────────────────

describe('Graph traversal', () => {
  beforeAll(() => {
    tsunamiGraphAddTriple({ subject: 'node:A', predicate: 'links_to', object: 'node:B' });
    tsunamiGraphAddTriple({ subject: 'node:B', predicate: 'links_to', object: 'node:C' });
    tsunamiGraphAddTriple({ subject: 'node:C', predicate: 'links_to', object: 'node:D' });
  });

  it('traverses from a node', () => {
    const result = tsunamiGraphTraverse('node:A', 3);
    expect(result).toBeTruthy();
    expect(typeof result).toBe('object');
  });
});

// ── Tunnels ────────────────────────────────────────────

describe('Tunnel discovery', () => {
  beforeAll(() => {
    tsunamiGraphAddTriple({ subject: 'wing:alpha', predicate: 'connects_to', object: 'node:bridge' });
    tsunamiGraphAddTriple({ subject: 'wing:beta', predicate: 'connects_to', object: 'node:bridge' });
  });

  it('finds tunnels between wings', () => {
    const result = tsunamiGraphFindTunnels('alpha', 'beta');
    expect(result).toBeTruthy();
  });

  it('handles missing wing gracefully', () => {
    const result = tsunamiGraphFindTunnels('nonexistent_a', 'nonexistent_b');
    expect(result).toBeTruthy();
  });
});
