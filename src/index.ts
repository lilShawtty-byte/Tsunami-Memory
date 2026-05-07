/**
 * TSUNAMI Memory System — Public API
 *
 * Bun-native oceanic memory with basin/current flow, storm center,
 * hot+cold retrieval, knowledge graph sync, and evidence linking.
 *
 * Usage:
 *   import { tsunamiSearch, tsunamiAdd, tsunamiStatus } from 'tsunami-memory';
 * */

// ── Core Memory Operations ──────────────────────────────────
export {
  tsunamiAdd,
  tsunamiSearch,
  tsunamiRecall,
  tsunamiWakeUp,
  tsunamiDiary,
  tsunamiStatus,
  tsunamiTimeline,
  tsunamiListWings,
} from './tsunami_client';

// ── Knowledge Graph ────────────────────────────────────────
export {
  tsunamiKgQuery,
  tsunamiKgAdd,
  tsunamiKgAddTyped,
  tsunamiKgStats,
  tsunamiKgTimeline,
} from './tsunami_client';

// ── Storm Center ────────────────────────────────────────────
export {
  buildTsunamiStormCenter,
  formatTsunamiStormCenterText,
} from './tsunami_storm_center';

// ── Execution Gate ──────────────────────────────────────────
export {
  buildTsunamiExecutionGate,
  deriveTsunamiLoopStepLimit,
  applyTsunamiExecutionGateToTool,
  formatTsunamiExecutionGateSummary,
} from './tsunami_execution_gate';

// ── Classification & Routing ────────────────────────────────
export { classifyMemory } from './tsunami_classifier';

// ── Types ───────────────────────────────────────────────────
export type { TsunamiBasin, TsunamiCurrent } from './tsunami_schema';
export type { TsunamiStormCenter } from './tsunami_storm_center';
export type { TsunamiExecutionGate } from './tsunami_execution_gate';

export type { TsunamiAddOptions } from './tsunami_client';
