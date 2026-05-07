/**
 * TSUNAMI runtime graph sync stub
 *
 * Provides the sync interface for project-level knowledge graph
 * synchronization. The full implementation uses file-watching and
 * incremental triple extraction; this stub returns empty results.
 */

export interface TsunamiRuntimeGraphSyncSummary {
  synced: number;
  conflicts: number;
  errors: string[];
}

export function syncProjectRuntimeGraph(_projectDir: string): TsunamiRuntimeGraphSyncSummary {
  return { synced: 0, conflicts: 0, errors: [] };
}
