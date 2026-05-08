import type { TsunamiStormPressure, TsunamiStormReadiness, TsunamiStormBoundary, TsunamiStormHorizon, TsunamiStormCenterStormMode, TsunamiStormConfidence } from './types';

export function buildStormConfidence(input: {
  stormPressure?: TsunamiStormPressure;
  stormReadiness?: TsunamiStormReadiness;
  stormBoundary?: TsunamiStormBoundary;
  stormHorizon?: TsunamiStormHorizon;
  stormMode?: TsunamiStormCenterStormMode;
}): TsunamiStormConfidence | undefined {
  const pressure = input.stormPressure;
  const readiness = input.stormReadiness;
  const boundary = input.stormBoundary;
  const horizon = input.stormHorizon;
  const mode = input.stormMode;
  if (!pressure && !readiness && !boundary && !horizon && !mode) return undefined;

  let score = 0.18;
  const reasons: string[] = [];

  if (readiness?.level === 'fortified') {
    score += 0.32;
    reasons.push('fortified support');
  } else if (readiness?.level === 'ready') {
    score += 0.22;
    reasons.push('ready support');
  } else if (readiness?.level === 'partial') {
    score += 0.08;
    reasons.push('partial support');
  } else if (readiness?.level === 'weak') {
    score -= 0.08;
    reasons.push('weak support');
  }

  if (boundary?.mode === 'sealed') {
    score += 0.16;
    reasons.push('sealed boundary');
  } else if (boundary?.mode === 'guarded') {
    score += 0.08;
    reasons.push('guarded boundary');
  } else if (boundary?.mode === 'permeable') {
    score -= 0.06;
    reasons.push('permeable boundary');
  } else if (boundary?.mode === 'spilling') {
    score -= 0.18;
    reasons.push('spilling boundary');
  }

  if (pressure?.level === 'calm') {
    score += 0.12;
    reasons.push('calm pressure');
  } else if (pressure?.level === 'steady') {
    score += 0.06;
    reasons.push('steady pressure');
  } else if (pressure?.level === 'rising') {
    score -= 0.08;
    reasons.push('rising pressure');
  } else if (pressure?.level === 'critical') {
    score -= 0.18;
    reasons.push('critical pressure');
  }

  if (mode?.mixed) {
    score -= 0.06;
    reasons.push('mixed sea-state');
  } else if (mode) {
    score += 0.04;
    reasons.push('coherent sea-state');
  }

  if (horizon?.label === 'multi_step') {
    score += 0.1;
    reasons.push('multi-step horizon');
  } else if (horizon?.label === 'two_step') {
    score += 0.05;
    reasons.push('two-step horizon');
  } else if (horizon?.label === 'single_step') {
    score -= 0.04;
    reasons.push('single-step horizon');
  }

  const normalized = Math.max(0, Math.min(1, Number(score.toFixed(2))));
  const level = normalized >= 0.74 ? 'high' : normalized >= 0.54 ? 'confident' : normalized >= 0.32 ? 'guarded' : 'low';
  return {
    level,
    score: normalized,
    reason: reasons.slice(0, 3).join(' · ') || 'confidence still settling',
  };
}
