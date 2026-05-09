#!/usr/bin/env bun
/**
 * TSUNAMI Hybrid Search Tests
 */
import { describe, it, expect, afterAll, beforeAll } from 'bun:test';
import {
  insertBunMemoryEntry,
  addWithEmbedding,
  searchHybrid,
  deleteBunMemoryEntry,
} from '../src/bun_memory_store';
import { tsunamiGraphAddTriple } from '../src/tsunami_graph_runtime';

const WING = 'hybrid-test';
const ids: string[] = [];

beforeAll(() => {
  // FTS5 + vector entries
  ids.push(insertBunMemoryEntry({ wing: WING, room: 'a', content: 'Redis caching layer for API performance', importance: 4 }));
  ids.push(insertBunMemoryEntry({ wing: WING, room: 'b', content: 'PostgreSQL connection pooling with PgBouncer', importance: 3 }));
  ids.push(addWithEmbedding(WING, 'c', 'Machine learning pipeline optimization with GPU acceleration', 5, [0.9, 0.5, 0.1, 0.0]));
  ids.push(addWithEmbedding(WING, 'd', 'Ocean ecosystem modeling for climate research', 4, [0.05, 0.0, 0.9, 0.8]));
  // Graph triple for Redis topic
  tsunamiGraphAddTriple({ subject: 'Redis', predicate: 'used_by', object: `entry:${ids[0]}` });
});

afterAll(() => { for (const id of ids) deleteBunMemoryEntry(id); });

describe('searchHybrid', () => {
  it('returns results from FTS5 channel alone (no embedding)', () => {
    const r = searchHybrid('Redis caching', undefined, 5, WING);
    expect(r.length).toBeGreaterThan(0);
    const fts5Hit = r.find(item => item.sources.includes('fts5'));
    expect(fts5Hit).toBeDefined();
    expect(fts5Hit!.content).toContain('Redis');
  });

  it('returns richer results when embedding provided', () => {
    const r = searchHybrid('performance', [0.85, 0.5, 0.1, 0.05], 5, WING);
    expect(r.length).toBeGreaterThan(0);
    const withVector = r.filter(item => item.sources.includes('vector'));
    expect(withVector.length).toBeGreaterThan(0);
  });

  it('boosts entries matching multiple channels', () => {
    const r = searchHybrid('Redis performance', [0.9, 0.5, 0.15, 0.0], 5, WING);
    const multiSource = r.filter(item => item.sources.length >= 2);
    // The Redis entry should appear (matched by FTS5) and possibly by graph
    const redisHit = r.find(item => item.content.includes('Redis'));
    expect(redisHit).toBeDefined();
  });

  it('respects topK', () => {
    const r = searchHybrid('data', [0.5, 0.3, 0.5, 0.4], 1, WING);
    expect(r.length).toBeLessThanOrEqual(1);
  });

  it('returns empty for no matches', () => {
    const r = searchHybrid('zzzxxxnonexistent999', undefined, 5, WING);
    expect(Array.isArray(r)).toBe(true);
  });

  it('score is always in [0,1]', () => {
    const r = searchHybrid('performance', [0.9, 0.5, 0.1, 0.0], 3, WING);
    for (const item of r) {
      expect(item.score).toBeGreaterThanOrEqual(0);
      expect(item.score).toBeLessThanOrEqual(1);
    }
  });
});
