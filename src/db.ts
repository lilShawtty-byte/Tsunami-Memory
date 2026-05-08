/**
 * TSUNAMI shared database connection.
 *
 * Single WAL-mode SQLite connection shared by all modules.
 * Schema is managed by the migration runner.
 */

import { Database } from 'bun:sqlite';
import { existsSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { BUN_MEMORY_DB_PATH } from './tsunami_storage_paths';
import { runMigrations, getMigrations } from './migration';

let _db: Database | null = null;

/** Get or create the shared database connection. Thread-safe via module-level singleton. */
export function getDb(): Database {
  if (_db) return _db;

  const dir = dirname(BUN_MEMORY_DB_PATH);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

  _db = new Database(BUN_MEMORY_DB_PATH);
  _db.run('PRAGMA journal_mode = WAL');

  const applied = runMigrations(_db, getMigrations());
  if (applied > 0) {
    const v = (_db.prepare('SELECT MAX(version) as v FROM schema_version').get() as any)?.v ?? 0;
    console.log(`[TSUNAMI] migrations applied: ${applied}, now at v${v}`);
  }

  return _db;
}

/** Close the database connection. Mainly useful in tests. */
export function closeDb(): void {
  if (_db) {
    _db.close();
    _db = null;
  }
}
