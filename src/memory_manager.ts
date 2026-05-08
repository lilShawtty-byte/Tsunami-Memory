/**
 * TSUNAMI Memory Manager — central memory fabric facade
 *
 * Wires together the memory fabric sub-modules (audit, promotion, recovery,
 * conflict resolution) into a single observable surface. Used by the storm
 * center and available for external consumers.
 */

import { auditMemoryFabric } from './memory_audit';
import { getDb } from './db';

/** Core memory fabric — observable memory operations. */
export const memoryFabric = {
  /** Audit a project's memory fabric and return issues + repair suggestions. */
  audit(projectDir: string) {
    return auditMemoryFabric(projectDir);
  },

  /** Get total memory count and wing distribution. */
  stats() {
    const db = getDb();
    const total = (db.prepare('SELECT COUNT(*) as c FROM memory_entries').get() as { c: number }).c;
    const wings = db.prepare(
      'SELECT wing, COUNT(*) as c FROM memory_entries GROUP BY wing ORDER BY c DESC'
    ).all() as Array<{ wing: string; c: number }>;
    const byWing: Record<string, number> = {};
    for (const w of wings) byWing[w.wing] = w.c;
    return { total, byWing };
  },

  /** Get memory entries with embeddings (for graph construction). */
  withEmbeddings(limit = 100) {
    const db = getDb();
    return db.prepare(
      'SELECT id, wing, room, content, embedding FROM memory_entries WHERE embedding IS NOT NULL ORDER BY created_at DESC LIMIT ?'
    ).all(limit) as Array<{ id: string; wing: string; room: string; content: string; embedding: unknown }>;
  },
};

/** Memory manager — lifecycle and configuration. */
export const memoryManager = {
  /** Compact old memories (placeholder — retains all entries for now). */
  compact(_olderThanDays = 30) {
    // Future: archive or prune memories older than threshold
    return { compacted: 0, remaining: memoryFabric.stats().total };
  },

  /** Get manager status. */
  status() {
    const s = memoryFabric.stats();
    return {
      backend: 'bun_native',
      total_entries: s.total,
      wings: Object.keys(s.byWing).length,
      has_embeddings: memoryFabric.withEmbeddings(1).length > 0,
    };
  },
};
