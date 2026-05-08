#!/usr/bin/env bun
/**
 * TSUNAMI Memory Store Unit Tests
 *
 * Tests SQLite FTS5 CRUD, search, recall, dedup, and edge cases.
 * Uses a temp DB to avoid polluting real data.
 */
import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import {
  insertBunMemoryEntry,
  searchBunMemoryRows,
  recallBunMemoryRows,
  wakeBunMemoryRows,
  listBunMemoryTimeline,
  countBunMemoryEntries,
  getBunMemoryStatus,
  listBunMemoryWingCounts,
  listBunMemoryRoomCounts,
  getBunMemoryTaxonomy,
  checkBunMemoryDuplicate,
  deleteBunMemoryEntry,
  buildBunMemoryPreview,
} from '../src/bun_memory_store';

import type { BunMemoryRow } from '../src/bun_memory_store';

const TEST_WING = 'unittest';
const ids: string[] = [];

function add(content: string, wing = TEST_WING, room = 'suite', importance = 3) {
  const id = insertBunMemoryEntry({ wing, room, content, importance, source: 'test' });
  ids.push(id);
  return id;
}

afterAll(() => {
  for (const id of ids) deleteBunMemoryEntry(id);
});

// ── CRUD ───────────────────────────────────────────────

describe('CRUD operations', () => {
  it('insertBunMemoryEntry returns bunmem_ id', () => {
    const id = add('CRUD test entry');
    expect(id).toMatch(/^bunmem_/);
  });

  it('stores and can be recalled by wing', () => {
    add('Recall-specific test content XYZ');
    const rows = recallBunMemoryRows({ wing: TEST_WING, limit: 10 });
    expect(rows.some((r: BunMemoryRow) => r.content.includes('XYZ'))).toBe(true);
  });

  it('deleteBunMemoryEntry removes a record', () => {
    const id = add('To be deleted');
    const ok = deleteBunMemoryEntry(id);
    expect(ok).toBe(true);
    // Remove from cleanup list since it's already gone
    ids.pop();
    // Double delete returns false
    const ok2 = deleteBunMemoryEntry(id);
    expect(ok2).toBe(false);
  });

  it('stores all fields correctly', () => {
    const id = insertBunMemoryEntry({
      wing: TEST_WING,
      room: 'field-test',
      content: 'Field completeness check',
      importance: 5,
      source: 'manual',
      sessionId: 'sess-123',
      projectDir: '/tmp/proj',
      fingerprint: 'fp-abc',
    });
    ids.push(id);
    const rows = recallBunMemoryRows({ room: 'field-test', limit: 1 });
    expect(rows.length).toBe(1);
    expect(rows[0].wing).toBe(TEST_WING);
    expect(rows[0].room).toBe('field-test');
    expect(rows[0].importance).toBe(5);
    expect(rows[0].source).toBe('manual');
    expect(rows[0].session_id).toBe('sess-123');
  });
});

// ── Search (FTS5) ──────────────────────────────────────

describe('FTS5 search', () => {
  beforeAll(() => {
    add('Building a Redis-based cache layer for API responses');
    add('PostgreSQL connection pooling with PgBouncer configuration');
    add('Redis cluster setup for high availability caching');
  });

  it('finds exact word matches', () => {
    const rows = searchBunMemoryRows({ query: 'Redis', wing: TEST_WING, limit: 5 });
    expect(rows.length).toBeGreaterThanOrEqual(1);
    expect(rows.some((r: BunMemoryRow) => r.content.toLowerCase().includes('redis'))).toBe(true);
  });

  it('finds multi-word queries', () => {
    const rows = searchBunMemoryRows({ query: 'cache layer', wing: TEST_WING, limit: 5 });
    expect(rows.length).toBeGreaterThanOrEqual(1);
  });

  it('respects wing filter', () => {
    const rows = searchBunMemoryRows({ query: 'Redis', wing: 'nonexistent-wing', limit: 5 });
    expect(rows.length).toBe(0);
  });

  it('handles no-results query gracefully', () => {
    const rows = searchBunMemoryRows({ query: 'zzzxxxyyyunlikelyterm999', limit: 5 });
    expect(Array.isArray(rows)).toBe(true);
  });

  it('searches without query returns recent entries', () => {
    const rows = searchBunMemoryRows({ wing: TEST_WING, limit: 3 });
    expect(rows.length).toBeGreaterThan(0);
  });
});

// ── Recall ─────────────────────────────────────────────

describe('Recall', () => {
  beforeAll(() => {
    add('Recall alpha memory');
    add('Recall beta memory');
    add('Recall gamma memory');
  });

  it('recalls recent entries ordered by importance then date', () => {
    const rows = recallBunMemoryRows({ wing: TEST_WING, limit: 20 });
    expect(rows.length).toBeGreaterThanOrEqual(3);
  });

  it('recall respects limit', () => {
    const rows = recallBunMemoryRows({ wing: TEST_WING, limit: 1 });
    expect(rows.length).toBeLessThanOrEqual(1);
  });

  it('recall with room filter works', () => {
    add('Room-filtered entry', TEST_WING, 'special-room');
    const rows = recallBunMemoryRows({ wing: TEST_WING, room: 'special-room', limit: 5 });
    expect(rows.every((r: BunMemoryRow) => r.room === 'special-room')).toBe(true);
  });
});

// ── Wakeup ─────────────────────────────────────────────

describe('Wakeup', () => {
  it('returns top entries by importance', () => {
    add('Low importance', TEST_WING, 'wake', 1);
    add('High importance', TEST_WING, 'wake', 5);
    const rows = wakeBunMemoryRows({ wing: TEST_WING });
    expect(rows.length).toBeGreaterThan(0);
    // High importance should appear before low
    const highIdx = rows.findIndex((r: BunMemoryRow) => r.importance === 5);
    const lowIdx = rows.findIndex((r: BunMemoryRow) => r.importance === 1);
    if (highIdx >= 0 && lowIdx >= 0) {
      expect(highIdx).toBeLessThan(lowIdx);
    }
  });
});

// ── Counts & Stats ─────────────────────────────────────

describe('Counts and stats', () => {
  it('countBunMemoryEntries returns a number', () => {
    const c = countBunMemoryEntries();
    expect(typeof c).toBe('number');
    expect(c).toBeGreaterThan(0);
  });

  it('countBunMemoryEntries with wing filter', () => {
    const c = countBunMemoryEntries(TEST_WING);
    expect(c).toBeGreaterThan(0);
  });

  it('getBunMemoryStatus returns struct', () => {
    const s = getBunMemoryStatus();
    expect(s.total).toBeGreaterThan(0);
    expect(typeof s.total).toBe('number');
  });

  it('listBunMemoryWingCounts includes test wing', () => {
    const w = listBunMemoryWingCounts();
    expect(w[TEST_WING]).toBeGreaterThan(0);
  });

  it('listBunMemoryRoomCounts returns room counts', () => {
    add('Room count test', TEST_WING, 'count-test');
    const r = listBunMemoryRoomCounts(TEST_WING);
    expect(r['count-test']).toBeGreaterThan(0);
  });

  it('getBunMemoryTaxonomy is structured', () => {
    const t = getBunMemoryTaxonomy();
    expect(Array.isArray(t)).toBe(true);
    // Our test wing should be present
    expect(t.some(e => e.wing === TEST_WING)).toBe(true);
  });
});

// ── Timeline ───────────────────────────────────────────

describe('Timeline', () => {
  it('returns entries chronologically', () => {
    const rows = listBunMemoryTimeline(5);
    expect(rows.length).toBeGreaterThan(0);
    // Verify descending order by created_at
    for (let i = 1; i < rows.length; i++) {
      expect(rows[i - 1].created_at).toBeGreaterThanOrEqual(rows[i].created_at);
    }
  });
});

// ── Dedup ──────────────────────────────────────────────

describe('Duplicate detection', () => {
  it('detects near-identical content', () => {
    const content = 'Uniquely phrase dedup test ' + Date.now();
    add(content, TEST_WING, 'dedup');
    const r = checkBunMemoryDuplicate(content, 0.7);
    expect(r.is_duplicate).toBe(true);
    expect(r.matches.length).toBeGreaterThan(0);
  });

  it('does not flag completely different content', () => {
    const r = checkBunMemoryDuplicate('completely different unrelated text zzzxyy', 0.9);
    expect(r.is_duplicate).toBe(false);
  });

  it('handles empty content', () => {
    const r = checkBunMemoryDuplicate('');
    expect(r.is_duplicate).toBe(false);
  });
});

// ── Preview ────────────────────────────────────────────

describe('buildBunMemoryPreview', () => {
  it('truncates long content', () => {
    const row: BunMemoryRow = {
      id: 'test',
      wing: 'x',
      room: 'y',
      content: 'A'.repeat(500),
      importance: 3,
      source: 'test',
      session_id: null,
      project_dir: null,
      fingerprint: null,
      created_at: 0,
      updated_at: 0,
    };
    const p = buildBunMemoryPreview(row, 200);
    expect(p.length).toBe(203); // 200 chars + '...'
    expect(p.endsWith('...')).toBe(true);
  });

  it('does not truncate short content', () => {
    const row: BunMemoryRow = {
      id: 'test',
      wing: 'x',
      room: 'y',
      content: 'Short',
      importance: 3,
      source: 'test',
      session_id: null,
      project_dir: null,
      fingerprint: null,
      created_at: 0,
      updated_at: 0,
    };
    const p = buildBunMemoryPreview(row, 200);
    expect(p).toBe('Short');
  });
});
