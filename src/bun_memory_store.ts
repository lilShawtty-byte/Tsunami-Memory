/**
 * TSUNAMI Bun Memory Store — SQLite-backed persistent memory
 *
 * The heart of TSUNAMI. Uses better-sqlite3 (synchronous) with FTS5 full-text search.
 * Stores memories as "drawers" organized by wing/room, with importance scoring
 * and content fingerprinting for deduplication.
 */

import { Database } from 'bun:sqlite';
import { existsSync, mkdirSync } from 'fs';
import { dirname } from 'path';
import { BUN_MEMORY_DB_PATH } from './tsunami_storage_paths';
export { BUN_MEMORY_DB_PATH };

// ── Database initialization ──────────────────────────────────

function ensureDbDir(): void {
  const dir = dirname(BUN_MEMORY_DB_PATH);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

let _db: Database | null = null;

function getDb(): Database {
  if (_db) return _db;
  ensureDbDir();
  _db = new Database(BUN_MEMORY_DB_PATH);

  // Enable WAL mode for better concurrent access
  _db.run('PRAGMA journal_mode = WAL');

  // Create the main memory table
  _db.exec(`
    CREATE TABLE IF NOT EXISTS memory_entries (
      id TEXT PRIMARY KEY,
      wing TEXT NOT NULL DEFAULT 'general',
      room TEXT NOT NULL DEFAULT 'inbox',
      content TEXT NOT NULL,
      importance INTEGER NOT NULL DEFAULT 3,
      source TEXT DEFAULT 'direct',
      session_id TEXT,
      project_dir TEXT,
      fingerprint TEXT,
      created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
      updated_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
    )
  `);

  // Create FTS5 virtual table for full-text search
  _db.exec(`
    CREATE VIRTUAL TABLE IF NOT EXISTS memory_fts USING fts5(
      content, wing, room,
      content='memory_entries',
      content_rowid='rowid'
    )
  `);

  // Create indexes for common queries
  _db.exec(`
    CREATE INDEX IF NOT EXISTS idx_memory_wing_room ON memory_entries(wing, room)
  `);
  _db.exec(`
    CREATE INDEX IF NOT EXISTS idx_memory_created_at ON memory_entries(created_at)
  `);
  _db.exec(`
    CREATE INDEX IF NOT EXISTS idx_memory_fingerprint ON memory_entries(fingerprint)
  `);

  // Triggers to keep FTS in sync
  _db.exec(`
    CREATE TRIGGER IF NOT EXISTS memory_fts_insert AFTER INSERT ON memory_entries BEGIN
      INSERT INTO memory_fts(rowid, content, wing, room)
      VALUES (new.rowid, new.content, new.wing, new.room);
    END
  `);
  _db.exec(`
    CREATE TRIGGER IF NOT EXISTS memory_fts_delete AFTER DELETE ON memory_entries BEGIN
      INSERT INTO memory_fts(memory_fts, rowid, content, wing, room)
      VALUES ('delete', old.rowid, old.content, old.wing, old.room);
    END
  `);
  _db.exec(`
    CREATE TRIGGER IF NOT EXISTS memory_fts_update AFTER UPDATE ON memory_entries BEGIN
      INSERT INTO memory_fts(memory_fts, rowid, content, wing, room)
      VALUES ('delete', old.rowid, old.content, old.wing, old.room);
      INSERT INTO memory_fts(rowid, content, wing, room)
      VALUES (new.rowid, new.content, new.wing, new.room);
    END
  `);

  return _db;
}

// ── ID Generation ────────────────────────────────────────────

function generateId(): string {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 8);
  return `bunmem_${ts}_${rand}`;
}

// ── Query Result Type ────────────────────────────────────────

export interface BunMemoryRow {
  id: string;
  wing: string;
  room: string;
  content: string;
  importance: number;
  source: string;
  session_id: string | null;
  project_dir: string | null;
  fingerprint: string | null;
  created_at: number;
  updated_at: number;
}

export interface BunMemoryInsertEntry {
  wing?: string;
  room?: string;
  content: string;
  importance?: number;
  source?: string;
  sessionId?: string;
  projectDir?: string;
  fingerprint?: string;
}

export interface BunMemorySearchOpts {
  query: string;
  wing?: string;
  room?: string;
  limit?: number;
}

export interface BunMemoryRecallOpts {
  wing?: string;
  room?: string;
  limit?: number;
}

export interface BunMemoryWakeOpts {
  wing?: string;
  limit?: number;
}

export interface BunMemoryTaxonomyEntry {
  wing: string;
  rooms: Record<string, number>;
}

// ── Public API ───────────────────────────────────────────────

export function insertBunMemoryEntry(entry: BunMemoryInsertEntry): string {
  const db = getDb();
  const id = generateId();
  const now = Date.now();

  const stmt = db.prepare(`
    INSERT INTO memory_entries (id, wing, room, content, importance, source, session_id, project_dir, fingerprint, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run(
    id,
    entry.wing || 'general',
    entry.room || 'inbox',
    entry.content,
    entry.importance ?? 3,
    entry.source || 'direct',
    entry.sessionId || null,
    entry.projectDir || null,
    entry.fingerprint || null,
    now,
    now,
  );

  return id;
}

export function searchBunMemoryRows(opts: BunMemorySearchOpts): BunMemoryRow[] {
  const db = getDb();
  const query = String(opts.query ?? '').trim();

  if (!query) {
    // Fall back to recall-style query if no search query provided
    return recallBunMemoryRows({ wing: opts.wing, room: opts.room, limit: opts.limit });
  }

  // Use FTS5 for full-text search
  const ftsQuery = query.replace(/[^\w\s\u4e00-\u9fa5]/g, ' ').trim();
  if (!ftsQuery) return [];

  const limit = Math.max(1, Math.min(100, Number(opts.limit ?? 5)));

  const sql = `
    SELECT m.*
    FROM memory_entries m
    JOIN memory_fts fts ON m.rowid = fts.rowid
    WHERE memory_fts MATCH ?
      ${opts.wing ? 'AND m.wing = ?' : ''}
      ${opts.room ? 'AND m.room = ?' : ''}
    ORDER BY rank
    LIMIT ?
  `;

  const params: any[] = [ftsQuery];
  if (opts.wing) params.push(opts.wing);
  if (opts.room) params.push(opts.room);
  params.push(limit);

  const stmt = db.prepare(sql);
  return stmt.all(...params) as BunMemoryRow[];
}

export function recallBunMemoryRows(opts: BunMemoryRecallOpts): BunMemoryRow[] {
  const db = getDb();
  const limit = Math.max(1, Math.min(100, Number(opts.limit ?? 10)));

  let sql = `
    SELECT * FROM memory_entries
    WHERE 1=1
      ${opts.wing ? 'AND wing = ?' : ''}
      ${opts.room ? 'AND room = ?' : ''}
    ORDER BY importance DESC, created_at DESC
    LIMIT ?
  `;

  const params: any[] = [];
  if (opts.wing) params.push(opts.wing);
  if (opts.room) params.push(opts.room);
  params.push(limit);

  const stmt = db.prepare(sql);
  return stmt.all(...params) as BunMemoryRow[];
}

export function wakeBunMemoryRows(opts: BunMemoryWakeOpts): BunMemoryRow[] {
  const db = getDb();
  const limit = Math.max(1, Math.min(50, Number(opts.limit ?? 10)));

  let sql = `
    SELECT * FROM memory_entries
    WHERE 1=1
      ${opts.wing ? 'AND wing = ?' : ''}
    ORDER BY importance DESC, created_at DESC
    LIMIT ?
  `;

  const params: any[] = [];
  if (opts.wing) params.push(opts.wing);
  params.push(limit);

  const stmt = db.prepare(sql);
  return stmt.all(...params) as BunMemoryRow[];
}

export function listBunMemoryTimeline(limit?: number): BunMemoryRow[] {
  const db = getDb();
  const max = Math.max(1, Math.min(200, Number(limit ?? 20)));

  const stmt = db.prepare(`
    SELECT * FROM memory_entries
    ORDER BY created_at DESC
    LIMIT ?
  `);

  return stmt.all(max) as BunMemoryRow[];
}

export function countBunMemoryEntries(wing?: string): number {
  const db = getDb();

  if (wing) {
    const stmt = db.prepare('SELECT COUNT(*) as count FROM memory_entries WHERE wing = ?');
    const row = stmt.get(wing) as { count: number };
    return row.count;
  }

  const stmt = db.prepare('SELECT COUNT(*) as count FROM memory_entries');
  const row = stmt.get() as { count: number };
  return row.count;
}

export function getBunMemoryStatus(): Record<string, unknown> {
  const db = getDb();

  const total = (db.prepare('SELECT COUNT(*) as count FROM memory_entries').get() as { count: number }).count;
  const wings = (db.prepare('SELECT COUNT(DISTINCT wing) as count FROM memory_entries').get() as { count: number }).count;
  const totalSize = (db.prepare("SELECT COUNT(*) as count FROM memory_entries WHERE length(content) > 0").get() as { count: number }).count;

  return {
    total,
    wings,
    total_drawers: total,
    backend: 'bun_native',
    db_path: BUN_MEMORY_DB_PATH,
    totalSize,
  };
}

export function listBunMemoryWingCounts(): Record<string, number> {
  const db = getDb();
  const rows = db.prepare('SELECT wing, COUNT(*) as count FROM memory_entries GROUP BY wing ORDER BY count DESC').all() as Array<{ wing: string; count: number }>;

  const result: Record<string, number> = {};
  for (const row of rows) {
    result[row.wing] = row.count;
  }
  return result;
}

export function listBunMemoryRoomCounts(wing?: string): Record<string, number> {
  const db = getDb();

  let rows: Array<{ room: string; count: number }>;
  if (wing) {
    rows = db.prepare('SELECT room, COUNT(*) as count FROM memory_entries WHERE wing = ? GROUP BY room ORDER BY count DESC').all(wing) as Array<{ room: string; count: number }>;
  } else {
    rows = db.prepare('SELECT room, COUNT(*) as count FROM memory_entries GROUP BY room ORDER BY count DESC').all() as Array<{ room: string; count: number }>;
  }

  const result: Record<string, number> = {};
  for (const row of rows) {
    result[row.room] = row.count;
  }
  return result;
}

export function getBunMemoryTaxonomy(): BunMemoryTaxonomyEntry[] {
  const db = getDb();
  const wings = db.prepare('SELECT DISTINCT wing FROM memory_entries ORDER BY wing').all() as Array<{ wing: string }>;

  return wings.map((w) => {
    const rooms = db.prepare('SELECT room, COUNT(*) as count FROM memory_entries WHERE wing = ? GROUP BY room ORDER BY count DESC').all(w.wing) as Array<{ room: string; count: number }>;
    const roomCounts: Record<string, number> = {};
    for (const r of rooms) {
      roomCounts[r.room] = r.count;
    }
    return { wing: w.wing, rooms: roomCounts };
  });
}

export function checkBunMemoryDuplicate(
  content: string,
  threshold = 0.9,
): { is_duplicate: boolean; matches: Array<{ id: string; wing: string; room: string; similarity: number; content: string }> } {
  const query = String(content ?? '').trim();
  if (!query) return { is_duplicate: false, matches: [] };

  // Tokenize the query content for comparison
  const qTokens = new Set(tokenize(query));

  const db = getDb();
  const rows = db.prepare('SELECT id, wing, room, content FROM memory_entries ORDER BY created_at DESC LIMIT 500').all() as BunMemoryRow[];

  const matches: Array<{ id: string; wing: string; room: string; similarity: number; content: string }> = [];

  for (const row of rows) {
    const dTokens = new Set(tokenize(row.content));
    const inter = [...qTokens].filter((t) => dTokens.has(t)).length;
    const union = new Set([...qTokens, ...dTokens]).size || 1;
    const sim = inter / union;

    if (sim >= threshold) {
      matches.push({
        id: row.id,
        wing: row.wing,
        room: row.room,
        similarity: Number(sim.toFixed(3)),
        content: row.content.slice(0, 200),
      });
    }
  }

  matches.sort((a, b) => b.similarity - a.similarity);
  return { is_duplicate: matches.length > 0, matches: matches.slice(0, 5) };
}

export function deleteBunMemoryEntry(id: string): boolean {
  const db = getDb();
  const result = db.prepare('DELETE FROM memory_entries WHERE id = ?').run(id);
  return result.changes > 0;
}

export function buildBunMemoryPreview(row: BunMemoryRow, maxLen: number): string {
  const text = String(row.content ?? '').replace(/\s+/g, ' ').trim();
  if (!text) return '';
  return text.length > maxLen ? `${text.slice(0, maxLen)}...` : text;
}

// ── Internal Helpers ─────────────────────────────────────────

function tokenize(text: string): string[] {
  return (text.toLowerCase().match(/[\u4e00-\u9fa5a-z0-9_]+/g) ?? []).filter(Boolean);
}
