/**
 * TSUNAMI durable recovery stub
 *
 * Provides the durable recovery store interface for cross-session recovery.
 * Returns null by default; the storm center handles missing recovery gracefully.
 */

export interface DurableRecoveryRecord {
  recoveryId: string;
  source: string;
  note?: string;
  lineageDepth?: number;
}

export interface DurableRecoveryLatestOpts {
  sessionId?: string;
  projectDir?: string;
}

export const durableRecoveryStore = {
  latest(_opts?: DurableRecoveryLatestOpts): DurableRecoveryRecord | null {
    return null;
  },
};
