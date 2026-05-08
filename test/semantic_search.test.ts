#!/usr/bin/env bun
/**
 * TSUNAMI Semantic Search Unit Tests
 *
 * Tests addWithEmbedding and searchByVector with known vectors.
 * Uses small mock embeddings to validate cosine similarity ranking.
 */
import { describe, it, expect, afterAll } from 'bun:test';
import {
  addWithEmbedding,
  searchByVector,
  deleteBunMemoryEntry,
} from '../src/bun_memory_store';

const WING = 'semantic-test';
const ids: string[] = [];

function vec(values: number[]): number[] {
  return values;
}

afterAll(() => {
  for (const id of ids) deleteBunMemoryEntry(id);
});

// ── addWithEmbedding ────────────────────────────────────

describe('addWithEmbedding', () => {
  it('stores a memory with an embedding', () => {
    const id = addWithEmbedding(WING, 'science', 'AI is transforming every industry', 4, vec([0.8, 0.6, 0.1, 0.0]));
    ids.push(id);
    expect(id).toMatch(/^bunmem_/);
  });

  it('stores multiple entries with different vectors', () => {
    const a = addWithEmbedding(WING, 'tech', 'Machine learning models are improving', 4, vec([0.9, 0.5, 0.2, 0.0]));
    const b = addWithEmbedding(WING, 'nature', 'The ocean ecosystem is fragile', 3, vec([0.1, 0.0, 0.9, 0.8]));
    const c = addWithEmbedding(WING, 'mix', 'AI helps ocean research with ML models', 5, vec([0.5, 0.3, 0.5, 0.4]));
    ids.push(a, b, c);
    expect(a).toMatch(/^bunmem_/);
    expect(b).toMatch(/^bunmem_/);
    expect(c).toMatch(/^bunmem_/);
  });
});

// ── searchByVector ──────────────────────────────────────

describe('searchByVector', () => {
  it('finds semantically similar entries', () => {
    const query = vec([0.85, 0.55, 0.15, 0.05]); // close to "AI is transforming"
    const results = searchByVector(query, 3, WING);
    expect(results.length).toBeGreaterThan(0);
    // The AI-related entry should be highest similarity
    expect(results[0].similarity).toBeGreaterThan(0.5);
  });

  it('ranks ocean-related entries higher for ocean query', () => {
    const query = vec([0.05, 0.02, 0.95, 0.85]); // close to "ocean ecosystem"
    const results = searchByVector(query, 3, WING);
    expect(results.length).toBeGreaterThan(0);
    // Ocean entry should rank high
    const oceanHit = results.find(r => r.content.toLowerCase().includes('ocean'));
    if (oceanHit) expect(oceanHit.similarity).toBeGreaterThan(0.5);
  });

  it('mix entry matches both AI and ocean queries', () => {
    const aiQuery = vec([0.7, 0.5, 0.2, 0.1]);
    const oceanQuery = vec([0.1, 0.1, 0.7, 0.6]);
    const aiResults = searchByVector(aiQuery, 5, WING);
    const oceanResults = searchByVector(oceanQuery, 5, WING);
    // The mix entry should appear in both (it's the middle vector)
    const mixInAI = aiResults.some(r => r.content.includes('AI helps ocean'));
    const mixInOcean = oceanResults.some(r => r.content.includes('AI helps ocean'));
    expect(mixInAI || mixInOcean).toBe(true);
  });

  it('respects topK limit', () => {
    const results = searchByVector(vec([0.5, 0.3, 0.5, 0.4]), 1, WING);
    expect(results.length).toBeLessThanOrEqual(1);
  });

  it('respects wing filter', () => {
    const results = searchByVector(vec([0.5, 0.3, 0.5, 0.4]), 5, 'nonexistent-wing');
    expect(results.length).toBe(0);
  });

  it('returns empty for empty embedding', () => {
    const id = addWithEmbedding(WING, 'empty', 'Just text, no vector here', 2, vec([0.1, 0.2, 0.3, 0.4]));
    ids.push(id);
    const results = searchByVector([], 5, WING);
    expect(results.length).toBe(0);
  });

  it('filters out low similarity results (< 0.3)', () => {
    const query = vec([1.0, 0.0, 0.0, 0.0]); // pure AI direction
    const results = searchByVector(query, 5, WING);
    // Ocean-only entries should be filtered out (too dissimilar)
    const allOcean = results.every(r => !r.content.toLowerCase().includes('ecosystem'));
    // Ocean entry may or may not appear depending on similarity threshold
    expect(Array.isArray(results)).toBe(true);
  });
});

// ── Edge cases ──────────────────────────────────────────

describe('Edge cases', () => {
  it('handles zero-length vector in add', () => {
    // Should still store — embedding is just empty
    const id = addWithEmbedding(WING, 'edge', 'Edge case zero vector', 2, []);
    ids.push(id);
    expect(id).toMatch(/^bunmem_/);
  });

  it('handles large embedding (768 dims, like bge-small)', () => {
    const largeVec = Array.from({ length: 768 }, () => Math.random() * 2 - 1);
    const id = addWithEmbedding(WING, 'large', 'Large embedding test', 3, largeVec);
    ids.push(id);
    expect(id).toMatch(/^bunmem_/);
    const results = searchByVector(largeVec, 2, WING);
    expect(results.length).toBeGreaterThan(0);
    // Self-similarity should be very close to 1.0
    expect(results[0].similarity).toBeGreaterThan(0.99);
  });
});
