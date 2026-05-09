/**
 * TSUNAMI Bun Memory Store — SQLite-backed persistent memory
 *
 * Stores memories as "drawers" organized by wing/room, with importance scoring
 * and content fingerprinting for deduplication. Schema managed by migration runner.
 */

import { getDb } from './db';
import { BUN_MEMORY_DB_PATH } from './tsunami_storage_paths';
import { tsunamiGraphQueryEntity } from './tsunami_graph_runtime';
export { BUN_MEMORY_DB_PATH };

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

// ── Vector / Semantic Search ─────────────────────────────────

/** Store a memory with an embedding vector for semantic search. */
export function addWithEmbedding(
  wing: string,
  room: string,
  content: string,
  importance: number,
  embedding: number[],
): string {
  const id = generateId();
  const now = Date.now();
  const blob = Buffer.from(new Float32Array(embedding).buffer);

  getDb().prepare(`
    INSERT INTO memory_entries (id, wing, room, content, importance, source, embedding, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    wing || 'general',
    room || 'inbox',
    content,
    Math.min(5, Math.max(1, importance ?? 3)),
    'embedding',
    blob as any, // Buffer is valid SQLite BLOB but bun:sqlite types don't recognize it
    now,
    now,
  );
  return id;
}

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

function blobToArray(blob: unknown): number[] | null {
  if (!blob) return null;
  try {
    // bun:sqlite returns BLOBs as Uint8Array; Node better-sqlite3 returns Buffer
    if (blob instanceof Uint8Array) {
      return Array.from(new Float32Array(blob.buffer.slice(blob.byteOffset, blob.byteOffset + blob.byteLength)));
    }
    if (Buffer.isBuffer(blob)) {
      return Array.from(new Float32Array(blob.buffer.slice(blob.byteOffset, blob.byteOffset + blob.byteLength)));
    }
    if (blob instanceof ArrayBuffer) {
      return Array.from(new Float32Array(blob));
    }
    return null;
  } catch {
    return null;
  }
}

/** Search memories by vector similarity. Returns top-K with similarity scores. */
export function searchByVector(
  embedding: number[],
  topK = 5,
  wing?: string,
): Array<{ id: string; wing: string; room: string; content: string; similarity: number }> {
  const db = getDb();
  let sql = 'SELECT id, wing, room, content, embedding FROM memory_entries WHERE embedding IS NOT NULL';
  const params: any[] = [];
  if (wing) { sql += ' AND wing = ?'; params.push(wing); }
  sql += ' ORDER BY created_at DESC LIMIT 500';

  const rows = db.prepare(sql).all(...params) as Array<{
    id: string; wing: string; room: string; content: string; embedding: unknown;
  }>;

  const scored = rows
    .map(row => {
      const vec = blobToArray(row.embedding);
      if (!vec) return null;
      return {
        id: row.id,
        wing: row.wing,
        room: row.room,
        content: row.content,
        similarity: Number(cosineSimilarity(embedding, vec).toFixed(4)),
      };
    })
    .filter((r): r is NonNullable<typeof r> => r !== null && r.similarity > 0.3)
    .sort((a, b) => b.similarity - a.similarity);

  return scored.slice(0, Math.max(1, topK));
}

// ── Hybrid Search ───────────────────────────────────────────

export interface HybridResult {
  id: string;
  wing: string;
  room: string;
  content: string;
  score: number;           // fused score [0,1]
  sources: string[];        // which channels contributed: fts5 | vector | graph
  keywordScore?: number;    // normalized FTS5 score
  vectorScore?: number;     // cosine similarity
  graphScore?: number;      // graph match signal
}

function normalizeScores(items: Array<{ id: string; score: number }>): Map<string, number> {
  const map = new Map<string, number>();
  if (items.length === 0) return map;
  const scores = items.map(i => i.score);
  const min = Math.min(...scores);
  const max = Math.max(...scores);
  const range = max - min || 1;
  for (const item of items) {
    map.set(item.id, (item.score - min) / range);
  }
  return map;
}

/**
 * Hybrid search — fuses FTS5, vector, and graph channels into a single
 * ranked result set. Weighted merge with deduplication.
 */
export function searchHybrid(
  query: string,
  embedding?: number[],
  topK = 5,
  wing?: string,
  weights?: { keyword?: number; vector?: number; graph?: number },
): HybridResult[] {
  const kw = weights?.keyword ?? 0.4;
  const vw = weights?.vector ?? 0.4;
  const gw = weights?.graph ?? 0.2;
  const scored = new Map<string, HybridResult>();

  // Channel 1: FTS5 keyword search
  const fts5Rows = searchBunMemoryRows({ query, wing, limit: 20 });
  // FTS5 returns no numeric score — use row position as proxy (top = highest)
  const fts5Scored = fts5Rows.map((r, i) => ({ id: r.id, score: fts5Rows.length - i }));
  const fts5Norm = normalizeScores(fts5Scored);
  for (const row of fts5Rows) {
    const score = (fts5Norm.get(row.id) ?? 0) * kw;
    scored.set(row.id, {
      id: row.id, wing: row.wing, room: row.room, content: row.content,
      score, sources: ['fts5'], keywordScore: fts5Norm.get(row.id) ?? 0,
    });
  }

  // Channel 2: Vector similarity
  if (embedding && embedding.length > 0) {
    const vecRows = searchByVector(embedding, 20, wing);
    const vecNorm = normalizeScores(vecRows.map(r => ({ id: r.id, score: r.similarity })));
    for (const row of vecRows) {
      const add = (vecNorm.get(row.id) ?? 0) * vw;
      const existing = scored.get(row.id);
      if (existing) {
        existing.score += add;
        existing.sources.push('vector');
        existing.vectorScore = vecNorm.get(row.id) ?? 0;
      } else {
        scored.set(row.id, {
          id: row.id, wing: row.wing, room: row.room, content: row.content,
          score: add, sources: ['vector'], vectorScore: vecNorm.get(row.id) ?? 0,
        });
      }
    }
  }

  // Channel 3: Knowledge graph (tokenize query into entities)
  const tokens = query.toLowerCase().split(/[\s,，。；;：:]+/).filter(t => t.length >= 2);
  for (const token of tokens.slice(0, 5)) {
    try {
      const triples = tsunamiGraphQueryEntity(token, undefined, 'both');
      for (const t of triples.slice(0, 10)) {
        const match = searchBunMemoryRows({ query: t.subject, wing, limit: 3 });
        for (const m of match) {
          const add = 0.5 * gw;
          const existing = scored.get(m.id);
          if (existing) {
            existing.score += add;
            if (!existing.sources.includes('graph')) existing.sources.push('graph');
            existing.graphScore = 0.5;
          }
        }
      }
    } catch {
      // Token not in graph — skip gracefully
    }
  }

  return Array.from(scored.values())
    .sort((a, b) => b.score - a.score)
    .slice(0, Math.max(1, topK))
    .map(r => ({ ...r, score: Math.min(1, Number(r.score.toFixed(4))) }));
}

// ── Temporal History ─────────────────────────────────────────

export interface MemoryHistoryRow {
  id: string;
  entry_id: string;
  wing: string | null;
  room: string | null;
  content: string | null;
  importance: number | null;
  changed_at: number;
  change_type: string;
}

/** Update a memory entry, preserving the old version in memory_history. */
export function updateBunMemoryEntry(
  id: string,
  fields: { content?: string; importance?: number; wing?: string; room?: string },
): boolean {
  const db = getDb();
  const old = db.prepare('SELECT * FROM memory_entries WHERE id = ?').get(id) as BunMemoryRow | undefined;
  if (!old) return false;

  // Archive old version
  db.prepare(`
    INSERT INTO memory_history (id, entry_id, wing, room, content, importance, changed_at, change_type)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    `hist_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
    id, old.wing, old.room, old.content, old.importance, Date.now(), 'update',
  );

  // Apply update
  const sets: string[] = [];
  const params: any[] = [];
  if (fields.content !== undefined) { sets.push('content = ?'); params.push(fields.content); }
  if (fields.importance !== undefined) { sets.push('importance = ?'); params.push(fields.importance); }
  if (fields.wing !== undefined) { sets.push('wing = ?'); params.push(fields.wing); }
  if (fields.room !== undefined) { sets.push('room = ?'); params.push(fields.room); }
  if (sets.length === 0) return false;
  sets.push('updated_at = ?');
  params.push(Date.now());
  params.push(id);

  db.prepare(`UPDATE memory_entries SET ${sets.join(', ')} WHERE id = ?`).run(...params);
  return true;
}

/** Get the complete change history for a single memory entry. */
export function getEntryHistory(entryId: string): MemoryHistoryRow[] {
  const db = getDb();
  return db.prepare(
    'SELECT * FROM memory_history WHERE entry_id = ? ORDER BY changed_at DESC'
  ).all(entryId) as MemoryHistoryRow[];
}

/** Get recent changes across all or filtered by wing. */
export function getRecentChanges(wing?: string, limit = 20): MemoryHistoryRow[] {
  const db = getDb();
  let sql = 'SELECT * FROM memory_history';
  const params: any[] = [];
  if (wing) { sql += ' WHERE wing = ?'; params.push(wing); }
  sql += ' ORDER BY changed_at DESC LIMIT ?';
  params.push(Math.max(1, Math.min(100, limit)));
  return db.prepare(sql).all(...params) as MemoryHistoryRow[];
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
