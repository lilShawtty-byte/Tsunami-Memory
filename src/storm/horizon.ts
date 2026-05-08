import type { TsunamiStormPressure, TsunamiStormReadiness, TsunamiStormBoundary, TsunamiStormCenterStormMode, TsunamiStormHorizon } from './types';

export function buildStormHorizon(input: {
  stormPressure?: TsunamiStormPressure;
  stormReadiness?: TsunamiStormReadiness;
  stormBoundary?: TsunamiStormBoundary;
  stormMode?: TsunamiStormCenterStormMode;
  topRepair?: TsunamiStormCenter['topRepair'];
  topIssue?: TsunamiStormCenter['topIssue'];
}): TsunamiStormHorizon | undefined {
  const pressure = input.stormPressure;
  const readiness = input.stormReadiness;
  const boundary = input.stormBoundary;
  const mode = input.stormMode;
  if (!pressure && !readiness && !boundary && !mode) return undefined;

  if (pressure?.level === 'critical' || boundary?.mode === 'spilling') {
    return {
      label: 'single_step',
      steps: 1,
      reason: `pressure ${pressure?.level || 'critical'} and boundary ${boundary?.mode || 'open'} mean we should only plan the next safe move`,
    };
  }
  if (boundary?.expand || readiness?.level === 'weak' || readiness?.level === 'partial') {
    return {
      label: 'short_run',
      steps: 1,
      reason: `support is still ${readiness?.level || 'thin'}, so gather anchors/evidence before planning beyond the immediate step`,
    };
  }
  if (readiness?.level === 'fortified' && boundary?.mode === 'sealed' && !mode?.mixed && (pressure?.level === 'calm' || pressure?.level === 'steady')) {
    return {
      label: 'multi_step',
      steps: 3,
      reason: `support is fortified, boundary is sealed, and pressure is ${pressure?.level || 'calm'}, so the storm can safely see several steps ahead`,
    };
  }
  if (readiness?.level === 'ready' || boundary?.mode === 'guarded') {
    return {
      label: 'two_step',
      steps: 2,
      reason: `support is stable enough for the next two moves, but we should keep the mainline under watch`,
    };
  }
  return {
    label: 'short_run',
    steps: 1,
    reason: input.topRepair || input.topIssue
      ? 'active repair/drift pressure suggests holding planning to the immediate correction window'
      : 'storm support is still settling, so keep the planning window short',
  };
}
