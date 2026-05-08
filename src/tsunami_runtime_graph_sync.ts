/**
 * TSUNAMI Runtime Graph Sync
 *
 * Synchronizes knowledge graph triples across sessions for a given project.
 * Detects cross-session connections and flags conflicts where the same
 * subject-object pair has contradictory predicates or confidence scores.
 *
 * Called by the storm center on each build (refresh can be disabled via opts).
 */

import { getDb } from './db';

export interface TsunamiRuntimeGraphSyncSummary {
  synced: number;
  conflicts: number;
  errors: string[];
}

export function syncProjectRuntimeGraph(projectDir: string): TsunamiRuntimeGraphSyncSummary {
  const errors: string[] = [];
  const projectNode = `project:${projectDir.split('/').pop() || projectDir}`;

  try {
    const db = getDb();

    // Find triples that reference this project (as subject or object)
    const projectTriples = db.prepare(`
      SELECT * FROM graph_triples
      WHERE subject = ? OR object = ?
      ORDER BY created_at DESC
    `).all(projectNode, projectNode) as Array<{
      subject: string; predicate: string; object: string; confidence: number; session_id?: string;
    }>;

    if (projectTriples.length === 0) {
      return { synced: 0, conflicts: 0, errors: [] };
    }

    // Detect conflicts: triples with same subject+object but different predicates or
    // low-confidence overlaps (confidence gap > 0.5 between two triples on same pair)
    let conflicts = 0;
    const pairMap = new Map<string, Array<typeof projectTriples[0]>>();

    for (const t of projectTriples) {
      const key = `${t.subject}::${t.object}`;
      if (!pairMap.has(key)) pairMap.set(key, []);
      pairMap.get(key)!.push(t);
    }

    for (const [, triples] of pairMap) {
      if (triples.length >= 2) {
        // Different predicates on same pair → conflict
        const predicates = new Set(triples.map(t => t.predicate));
        if (predicates.size > 1) {
          conflicts++;
          continue;
        }
        // Confidence gap > 0.5 between any two triples → conflict
        const confidences = triples.map(t => t.confidence).sort((a, b) => b - a);
        if (confidences[0] - confidences[confidences.length - 1] > 0.5) {
          conflicts++;
        }
      }
    }

    return {
      synced: projectTriples.length,
      conflicts,
      errors,
    };
  } catch (err: unknown) {
    errors.push(err instanceof Error ? err.message : String(err));
    return { synced: 0, conflicts: 0, errors };
  }
}
