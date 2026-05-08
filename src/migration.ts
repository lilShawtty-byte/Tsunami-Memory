/**
 * TSUNAMI Schema Migration System
 *
 * Versioned, idempotent migrations for the SQLite database.
 * Each migration has a version number and an `up` function.
 * The `schema_version` table tracks which migrations have been applied.
 *
 * Usage:
 *   import { runMigrations } from './migration';
 *   const db = new Database(path);
 *   const applied = runMigrations(db, getMigrations());
 */

import type { Database } from 'bun:sqlite';

export interface Migration {
  version: number;
  name: string;
  up: (db: Database) => void;
}

const SCHEMA_TABLE = 'schema_version';

/** Ensure the schema_version tracking table exists. */
function ensureVersionTable(db: Database): void {
  db.run(`
    CREATE TABLE IF NOT EXISTS ${SCHEMA_TABLE} (
      version   INTEGER PRIMARY KEY,
      name      TEXT    NOT NULL,
      appliedAt INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
    )
  `);
}

/** Get the highest applied migration version. */
function currentVersion(db: Database): number {
  ensureVersionTable(db);
  const row = db.prepare(
    `SELECT MAX(version) as v FROM ${SCHEMA_TABLE}`
  ).get() as { v: number | null } | undefined;
  return row?.v ?? 0;
}

/** Apply a single migration if not already applied. */
function applyMigration(db: Database, m: Migration): boolean {
  const existing = db.prepare(
    `SELECT 1 FROM ${SCHEMA_TABLE} WHERE version = ?`
  ).get(m.version);
  if (existing) return false;

  m.up(db);
  db.prepare(
    `INSERT INTO ${SCHEMA_TABLE} (version, name) VALUES (?, ?)`
  ).run(m.version, m.name);
  return true;
}

/** Run all pending migrations in order. Returns count of newly applied. */
export function runMigrations(db: Database, migrations: Migration[]): number {
  ensureVersionTable(db);
  const current = currentVersion(db);
  const pending = migrations
    .filter(m => m.version > current)
    .sort((a, b) => a.version - b.version);

  let applied = 0;
  for (const m of pending) {
    if (applyMigration(db, m)) applied++;
  }
  return applied;
}

// ═══════════════════════════════════════════════════════════
// Migration definitions
// ═══════════════════════════════════════════════════════════

/** v1 — Initial schema: memory entries + FTS5 + knowledge graph. */
const v1_initial_schema: Migration = {
  version: 1,
  name: 'initial_schema',
  up(db) {
    // Memory entries
    db.run(`
      CREATE TABLE IF NOT EXISTS memory_entries (
        id          TEXT PRIMARY KEY,
        wing        TEXT NOT NULL DEFAULT 'general',
        room        TEXT NOT NULL DEFAULT 'inbox',
        content     TEXT NOT NULL,
        importance  INTEGER NOT NULL DEFAULT 3,
        source      TEXT DEFAULT 'direct',
        session_id  TEXT,
        project_dir TEXT,
        fingerprint TEXT,
        created_at  INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
        updated_at  INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
      )
    `);

    // FTS5 virtual table
    db.run(`
      CREATE VIRTUAL TABLE IF NOT EXISTS memory_fts USING fts5(
        content, wing, room,
        content='memory_entries',
        content_rowid='rowid'
      )
    `);

    // FTS sync triggers
    db.run(`
      CREATE TRIGGER IF NOT EXISTS memory_ai AFTER INSERT ON memory_entries BEGIN
        INSERT INTO memory_fts(rowid, content, wing, room)
        VALUES (new.rowid, new.content, new.wing, new.room);
      END
    `);
    db.run(`
      CREATE TRIGGER IF NOT EXISTS memory_ad AFTER DELETE ON memory_entries BEGIN
        INSERT INTO memory_fts(memory_fts, rowid, content, wing, room)
        VALUES ('delete', old.rowid, old.content, old.wing, old.room);
      END
    `);
    db.run(`
      CREATE TRIGGER IF NOT EXISTS memory_au AFTER UPDATE ON memory_entries BEGIN
        INSERT INTO memory_fts(memory_fts, rowid, content, wing, room)
        VALUES ('delete', old.rowid, old.content, old.wing, old.room);
        INSERT INTO memory_fts(rowid, content, wing, room)
        VALUES (new.rowid, new.content, new.wing, new.room);
      END
    `);

    // Indexes
    db.run(`CREATE INDEX IF NOT EXISTS idx_mem_wing    ON memory_entries(wing)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_mem_room    ON memory_entries(room)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_mem_created ON memory_entries(created_at)`);

    // Knowledge graph
    db.run(`
      CREATE TABLE IF NOT EXISTS graph_triples (
        id                 TEXT PRIMARY KEY,
        subject            TEXT NOT NULL,
        predicate          TEXT NOT NULL,
        object             TEXT NOT NULL,
        subject_type       TEXT,
        object_type        TEXT,
        subject_properties TEXT DEFAULT '{}',
        object_properties  TEXT DEFAULT '{}',
        confidence         REAL NOT NULL DEFAULT 1.0,
        valid_from         TEXT,
        valid_to           TEXT,
        source_file        TEXT,
        created_at         INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
      )
    `);

    db.run(`CREATE INDEX IF NOT EXISTS idx_graph_subject   ON graph_triples(subject)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_graph_object    ON graph_triples(object)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_graph_predicate ON graph_triples(predicate)`);
  },
};

/** v2 — Add embedding column for vector search. */
const v2_add_embedding_column: Migration = {
  version: 2,
  name: 'add_embedding_column',
  up(db) {
    db.run(`ALTER TABLE memory_entries ADD COLUMN embedding BLOB`);
  },
};

/** All migrations in version order. Add new entries at the end. */
export function getMigrations(): Migration[] {
  return [v1_initial_schema, v2_add_embedding_column];
}
