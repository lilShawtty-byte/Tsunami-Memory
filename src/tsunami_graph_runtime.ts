/**
 * TSUNAMI Knowledge Graph Runtime — SQLite-backed triple store
 *
 * Adds graph tables to the TSUNAMI memory database for storing and querying
 * subject-predicate-object triples. Supports temporal validity tracking,
 * BFS traversal, and cross-wing tunnel discovery.
 */

import { Database } from 'bun:sqlite';
import { BUN_MEMORY_DB_PATH } from './tsunami_storage_paths';

// ── Database initialization ──────────────────────────────────

let _db: Database | null = null;

function getDb(): Database {
  if (_db) return _db;

  _db = new Database(BUN_MEMORY_DB_PATH);
  _db.run('PRAGMA journal_mode = WAL');

  _db.exec(`
    CREATE TABLE IF NOT EXISTS graph_triples (
      id TEXT PRIMARY KEY,
      subject TEXT NOT NULL,
      predicate TEXT NOT NULL,
      object TEXT NOT NULL,
      subject_type TEXT,
      object_type TEXT,
      subject_properties TEXT DEFAULT '{}',
      object_properties TEXT DEFAULT '{}',
      confidence REAL NOT NULL DEFAULT 1.0,
      valid_from TEXT,
      valid_to TEXT,
      source_file TEXT,
      created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
    )
  `);

  // Indexes for common graph queries
  _db.exec(`CREATE INDEX IF NOT EXISTS idx_graph_subject ON graph_triples(subject)`);
  _db.exec(`CREATE INDEX IF NOT EXISTS idx_graph_predicate ON graph_triples(predicate)`);
  _db.exec(`CREATE INDEX IF NOT EXISTS idx_graph_object ON graph_triples(object)`);
  _db.exec(`CREATE INDEX IF NOT EXISTS idx_graph_subject_predicate ON graph_triples(subject, predicate)`);
  _db.exec(`CREATE INDEX IF NOT EXISTS idx_graph_valid_to ON graph_triples(valid_to)`);

  return _db;
}

// ── ID Generation ────────────────────────────────────────────

function generateId(): string {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 8);
  return `kg_${ts}_${rand}`;
}

// ── Types ────────────────────────────────────────────────────

export interface GraphTriple {
  id: string;
  subject: string;
  predicate: string;
  object: string;
  subject_type: string | null;
  object_type: string | null;
  subject_properties: string;
  object_properties: string;
  confidence: number;
  valid_from: string | null;
  valid_to: string | null;
  source_file: string | null;
  created_at: number;
}

export interface GraphAddTripleInput {
  subject: string;
  subjectType?: string;
  subjectProperties?: Record<string, unknown>;
  predicate: string;
  object: string;
  objectType?: string;
  objectProperties?: Record<string, unknown>;
  validFrom?: string;
  validTo?: string;
  confidence?: number;
  sourceCloset?: string;
  sourceFile?: string;
}

export interface GraphInvalidateTripleInput {
  subject: string;
  predicate: string;
  object: string;
  ended?: string;
}

export interface GraphTraverseResult {
  startRoom: string;
  maxHops: number;
  visited: string[];
  nodes: Array<{
    entity: string;
    depth: number;
    relation: string;
    confidence: number;
  }>;
  error?: string;
}

export interface GraphTunnelResult {
  wingA: string;
  wingB: string;
  tunnels: Array<{
    subject: string;
    predicate: string;
    object: string;
    confidence: number;
  }>;
}

// ── Public API ───────────────────────────────────────────────

export function tsunamiGraphAddTriple(input: GraphAddTripleInput): string {
  const db = getDb();
  const id = generateId();

  const stmt = db.prepare(`
    INSERT INTO graph_triples (id, subject, predicate, object, subject_type, object_type, subject_properties, object_properties, confidence, valid_from, valid_to, source_file)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run(
    id,
    input.subject,
    input.predicate,
    input.object,
    input.subjectType || null,
    input.objectType || null,
    JSON.stringify(input.subjectProperties || {}),
    JSON.stringify(input.objectProperties || {}),
    input.confidence ?? 1.0,
    input.validFrom || null,
    input.validTo || null,
    input.sourceFile || null,
  );

  return id;
}

export function tsunamiGraphQueryEntity(
  entity: string,
  asOf?: string,
  direction: 'outgoing' | 'incoming' | 'both' = 'outgoing',
): GraphTriple[] {
  const db = getDb();

  const conditions: string[] = [];
  const params: any[] = [];

  if (direction === 'outgoing' || direction === 'both') {
    conditions.push('(subject = ?)');
    params.push(entity);
  }
  if (direction === 'incoming' || direction === 'both') {
    conditions.push('(object = ?)');
    params.push(entity);
  }

  if (asOf) {
    conditions.push('(valid_from IS NULL OR valid_from <= ?)');
    params.push(asOf);
    conditions.push('(valid_to IS NULL OR valid_to >= ?)');
    params.push(asOf);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' OR ')}` : '';
  const sql = `SELECT * FROM graph_triples ${whereClause} ORDER BY confidence DESC, created_at DESC`;

  const stmt = db.prepare(sql);
  return stmt.all(...params) as GraphTriple[];
}

export function tsunamiGraphInvalidateTriple(input: GraphInvalidateTripleInput): number {
  const db = getDb();
  const ended = input.ended || new Date().toISOString();

  const stmt = db.prepare(`
    UPDATE graph_triples
    SET valid_to = ?
    WHERE subject = ? AND predicate = ? AND object = ? AND valid_to IS NULL
  `);

  const result = stmt.run(ended, input.subject, input.predicate, input.object);
  return result.changes;
}

export function tsunamiGraphStats(): Record<string, unknown> {
  const db = getDb();

  const total = (db.prepare('SELECT COUNT(*) as count FROM graph_triples').get() as { count: number }).count;
  const active = (db.prepare('SELECT COUNT(*) as count FROM graph_triples WHERE valid_to IS NULL').get() as { count: number }).count;
  const subjects = (db.prepare('SELECT COUNT(DISTINCT subject) as count FROM graph_triples').get() as { count: number }).count;

  return {
    total,
    active,
    subjects,
    backend: 'bun_native',
  };
}

export function tsunamiGraphCompatStats(): Record<string, unknown> {
  // Alias for graph_stats compatibility
  return tsunamiGraphStats();
}

export function tsunamiGraphTimeline(entity?: string, limit = 20): GraphTriple[] {
  const db = getDb();
  const max = Math.max(1, Math.min(200, Number(limit ?? 20)));

  let sql: string;
  let params: any[];

  if (entity) {
    sql = `
      SELECT * FROM graph_triples
      WHERE subject = ? OR object = ?
      ORDER BY created_at DESC
      LIMIT ?
    `;
    params = [entity, entity, max];
  } else {
    sql = `
      SELECT * FROM graph_triples
      ORDER BY created_at DESC
      LIMIT ?
    `;
    params = [max];
  }

  const stmt = db.prepare(sql);
  return stmt.all(...params) as GraphTriple[];
}

export function tsunamiGraphTraverse(startRoom: string, maxHops = 2): GraphTraverseResult {
  const db = getDb();
  const start = String(startRoom ?? '').trim();

  if (!start) {
    return { startRoom: '', maxHops, visited: [], nodes: [], error: 'startRoom is required' };
  }

  const visited = new Set<string>();
  const nodes: GraphTraverseResult['nodes'] = [];
  let queue: Array<{ entity: string; depth: number }> = [{ entity: start, depth: 0 }];
  const hops = Math.max(1, Math.min(10, Number(maxHops ?? 2)));

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (visited.has(current.entity)) continue;
    visited.add(current.entity);

    // Find outgoing edges
    const outgoing = db.prepare(
      'SELECT * FROM graph_triples WHERE subject = ? AND valid_to IS NULL ORDER BY confidence DESC',
    ).all(current.entity) as GraphTriple[];

    for (const triple of outgoing) {
      if (!visited.has(triple.object)) {
        nodes.push({
          entity: triple.object,
          depth: current.depth + 1,
          relation: triple.predicate,
          confidence: triple.confidence,
        });
        if (current.depth + 1 < hops) {
          queue.push({ entity: triple.object, depth: current.depth + 1 });
        }
      }
    }

    // Find incoming edges
    const incoming = db.prepare(
      'SELECT * FROM graph_triples WHERE object = ? AND valid_to IS NULL ORDER BY confidence DESC',
    ).all(current.entity) as GraphTriple[];

    for (const triple of incoming) {
      if (!visited.has(triple.subject)) {
        nodes.push({
          entity: triple.subject,
          depth: current.depth + 1,
          relation: triple.predicate,
          confidence: triple.confidence,
        });
        if (current.depth + 1 < hops) {
          queue.push({ entity: triple.subject, depth: current.depth + 1 });
        }
      }
    }
  }

  return {
    startRoom: start,
    maxHops: hops,
    visited: Array.from(visited),
    nodes,
  };
}

export function tsunamiGraphFindTunnels(wingA?: string, wingB?: string): GraphTunnelResult[] {
  const db = getDb();

  // Find cross-wing tunnels: triples where subject and object belong to different wings
  const results: GraphTunnelResult[] = [];
  const limit = 20;

  let sql: string;
  let params: any[];

  if (wingA && wingB) {
    sql = `
      SELECT * FROM graph_triples
      WHERE ((subject LIKE ? AND object LIKE ?) OR (subject LIKE ? AND object LIKE ?))
        AND valid_to IS NULL
      ORDER BY confidence DESC
      LIMIT ?
    `;
    params = [`${wingA}:%`, `${wingB}:%`, `${wingB}:%`, `${wingA}:%`, limit];
  } else if (wingA) {
    sql = `
      SELECT * FROM graph_triples
      WHERE (subject LIKE ? OR object LIKE ?)
        AND valid_to IS NULL
      ORDER BY confidence DESC
      LIMIT ?
    `;
    params = [`${wingA}:%`, `${wingA}:%`, limit];
  } else {
    sql = `
      SELECT * FROM graph_triples
      WHERE valid_to IS NULL
        AND ((subject LIKE 'task:%' AND object LIKE 'memory:%')
          OR (subject LIKE 'decision:%' AND object LIKE 'task:%')
          OR (subject LIKE 'ats:%' AND object LIKE 'decision:%')
          OR (subject LIKE 'memory:%' AND object LIKE 'people:%'))
      ORDER BY confidence DESC
      LIMIT ?
    `;
    params = [limit];
  }

  const triples = db.prepare(sql).all(...params) as GraphTriple[];

  // Group by wing pairs
  const tunnelMap = new Map<string, GraphTriple[]>();

  for (const triple of triples) {
    const sWing = triple.subject.split('/')[0] || triple.subject.split(':')[0];
    const oWing = triple.object.split('/')[0] || triple.object.split(':')[0];

    if (sWing && oWing && sWing !== oWing) {
      const key = [sWing, oWing].sort().join('--');
      if (!tunnelMap.has(key)) tunnelMap.set(key, []);
      tunnelMap.get(key)!.push(triple);
    }
  }

  for (const [key, tunnels] of tunnelMap) {
    const [wa, wb] = key.split('--');
    results.push({
      wingA: wa,
      wingB: wb,
      tunnels: tunnels.slice(0, 10).map((t) => ({
        subject: t.subject,
        predicate: t.predicate,
        object: t.object,
        confidence: t.confidence,
      })),
    });
  }

  return results;
}
