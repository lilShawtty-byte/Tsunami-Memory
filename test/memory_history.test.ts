#!/usr/bin/env bun
/**
 * TSUNAMI Temporal History Tests
 */
import { describe, it, expect, afterAll } from 'bun:test';
import {
  insertBunMemoryEntry,
  updateBunMemoryEntry,
  getEntryHistory,
  getRecentChanges,
  deleteBunMemoryEntry,
} from '../src/bun_memory_store';

const WING = 'history-test';
const ids: string[] = [];

afterAll(() => { for (const id of ids) deleteBunMemoryEntry(id); });

describe('updateBunMemoryEntry', () => {
  it('updates content and archives old version', () => {
    const id = insertBunMemoryEntry({ wing: WING, room: 'v1', content: 'Original version', importance: 3 });
    ids.push(id);

    const updated = updateBunMemoryEntry(id, { content: 'Updated version', importance: 5 });
    expect(updated).toBe(true);

    const history = getEntryHistory(id);
    expect(history.length).toBe(1);
    expect(history[0].content).toBe('Original version');
    expect(history[0].change_type).toBe('update');
  });

  it('updates multiple fields in one call', () => {
    const id = insertBunMemoryEntry({ wing: WING, room: 'multi', content: 'Multi field test', importance: 2 });
    ids.push(id);

    updateBunMemoryEntry(id, { content: 'New content', importance: 4, wing: 'changed-wing' });
    const history = getEntryHistory(id);
    expect(history.length).toBe(1);
    expect(history[0].wing).toBe(WING); // old wing preserved
    expect(history[0].content).toBe('Multi field test');
  });

  it('returns false for nonexistent entry', () => {
    expect(updateBunMemoryEntry('nonexistent-id', { content: 'x' })).toBe(false);
  });

  it('returns false for empty fields', () => {
    const id = insertBunMemoryEntry({ wing: WING, room: 'empty', content: 'No update fields', importance: 2 });
    ids.push(id);
    expect(updateBunMemoryEntry(id, {})).toBe(false);
  });
});

describe('getEntryHistory', () => {
  it('returns empty array for unknown entry', () => {
    const history = getEntryHistory('nonexistent');
    expect(history).toEqual([]);
  });

  it('tracks multiple updates (all versions archived)', () => {
    const id = insertBunMemoryEntry({ wing: WING, room: 'multi-v', content: 'Version 1', importance: 1 });
    ids.push(id);

    updateBunMemoryEntry(id, { content: 'Version 2' });
    updateBunMemoryEntry(id, { content: 'Version 3' });

    const history = getEntryHistory(id);
    expect(history.length).toBe(2);
    const contents = history.map(h => h.content);
    expect(contents).toContain('Version 1');
    expect(contents).toContain('Version 2');
  });
});

describe('getRecentChanges', () => {
  it('returns changes across all wings by default', () => {
    const changes = getRecentChanges(undefined, 10);
    expect(Array.isArray(changes)).toBe(true);
  });

  it('filters changes by wing', () => {
    const changes = getRecentChanges('nonexistent-wing-xyz', 10);
    expect(changes.length).toBe(0);
  });

  it('respects limit', () => {
    const changes = getRecentChanges(undefined, 1);
    expect(changes.length).toBeLessThanOrEqual(1);
  });
});
