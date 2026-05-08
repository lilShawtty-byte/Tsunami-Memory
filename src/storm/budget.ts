import type { TsunamiStormGate, TsunamiStormHorizon, TsunamiStormReadiness, TsunamiStormConfidence, TsunamiStormBudget } from './types';

export function buildStormBudget(input: {
  stormGate?: TsunamiStormGate;
  stormHorizon?: TsunamiStormHorizon;
  stormReadiness?: TsunamiStormReadiness;
  stormConfidence?: TsunamiStormConfidence;
}): TsunamiStormBudget | undefined {
  const gate = input.stormGate;
  const horizon = input.stormHorizon;
  const readiness = input.stormReadiness;
  const confidence = input.stormConfidence;
  if (!gate && !horizon && !readiness && !confidence) return undefined;

  const horizonSteps = Math.max(0, Number(horizon?.steps || 0));
  if (gate?.verdict === 'hold') {
    return {
      mode: 'frozen',
      steps: 0,
      reason: gate.reason,
    };
  }
  if (gate?.verdict === 'guarded' || readiness?.level === 'weak' || readiness?.level === 'partial' || confidence?.level === 'guarded' || confidence?.level === 'low') {
    return {
      mode: 'minimal',
      steps: 1,
      reason: 'advance only the immediate correction move while support and confidence continue converging',
    };
  }
  if (gate?.verdict === 'expand' && (confidence?.level === 'high' || confidence?.level === 'confident')) {
    return {
      mode: 'open',
      steps: Math.max(2, Math.min(3, horizonSteps || 3)),
      reason: 'guidance is strong enough to approve a broader forward window',
    };
  }
  return {
    mode: 'guided',
    steps: Math.max(1, Math.min(2, horizonSteps || 2)),
    reason: 'advance with a bounded budget while keeping the mainline under active watch',
  };
}
