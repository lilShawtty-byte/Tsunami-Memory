/**
 * TSUNAMI Storm Center — barrel file
 *
 * The storm center has been split into modular components under src/storm/.
 * This file re-exports the public API for backward compatibility.
 *
 * Module map:
 *   types.ts      — all storm-related types
 *   helpers.ts    — node builders, clamping, tokenization, fallback docs, retry
 *   signals.ts    — buildCurrents, buildCurrentMix
 *   basins.ts     — buildSupportingBasins
 *   mode.ts       — buildStormMode
 *   pressure.ts   — buildStormPressure
 *   directive.ts  — buildStormDirective, buildStormAction
 *   readiness.ts  — buildStormReadiness
 *   boundary.ts   — buildStormBoundary
 *   horizon.ts    — buildStormHorizon
 *   confidence.ts — buildStormConfidence
 *   gate.ts       — buildStormGate
 *   budget.ts     — buildStormBudget
 *   selection.ts  — buildStormSelection
 *   coverage.ts   — buildStormCoverage
 *   saturation.ts — buildStormSaturation
 *   intake.ts     — buildStormIntake
 *   center.ts     — buildTsunamiStormCenter, formatTsunamiStormCenterText
 */

export {
  buildTsunamiStormCenter,
  formatTsunamiStormCenterText,
  isTsunamiStormRetryableError,
  withTsunamiStormRetry,
} from './storm/center';

export type {
  TsunamiStormCenterCurrent,
  TsunamiStormCenterCurrentMix,
  TsunamiStormCenterStormMode,
  TsunamiStormPressure,
  TsunamiStormDirective,
  TsunamiStormAction,
  TsunamiStormReadiness,
  TsunamiStormBoundary,
  TsunamiStormHorizon,
  TsunamiStormConfidence,
  TsunamiStormGate,
  TsunamiStormBudget,
  TsunamiStormSelection,
  TsunamiStormCoverage,
  TsunamiStormSaturation,
  TsunamiStormIntake,
  TsunamiStormCenter,
} from './storm/types';
