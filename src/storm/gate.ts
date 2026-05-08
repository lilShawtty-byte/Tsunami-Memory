import type { TsunamiStormPressure, TsunamiStormReadiness, TsunamiStormConfidence, TsunamiStormBoundary, TsunamiStormHorizon, TsunamiStormGate } from './types';

export function buildStormGate(input: {
  stormPressure?: TsunamiStormPressure;
  stormReadiness?: TsunamiStormReadiness;
  stormConfidence?: TsunamiStormConfidence;
  stormBoundary?: TsunamiStormBoundary;
  stormHorizon?: TsunamiStormHorizon;
}): TsunamiStormGate | undefined {
  const pressure = input.stormPressure;
  const readiness = input.stormReadiness;
  const confidence = input.stormConfidence;
  const boundary = input.stormBoundary;
  const horizon = input.stormHorizon;
  if (!pressure && !readiness && !confidence && !boundary && !horizon) return undefined;

  if (pressure?.level === 'critical' || boundary?.mode === 'spilling' || confidence?.level === 'low') {
    return {
      verdict: 'hold',
      allowForward: false,
      reason: `hold the line until pressure/boundary/confidence stabilizes (${pressure?.level || boundary?.mode || confidence?.level || 'unknown'})`,
    };
  }
  if (boundary?.expand || readiness?.level === 'partial' || readiness?.level === 'weak') {
    return {
      verdict: 'guarded',
      allowForward: false,
      reason: `keep execution guarded while support is still ${readiness?.level || 'thin'} and the storm may need wider support`,
    };
  }
  if ((confidence?.level === 'high' || confidence?.level === 'confident') && boundary?.mode === 'sealed' && (horizon?.steps || 0) >= 3) {
    return {
      verdict: 'expand',
      allowForward: true,
      reason: `guidance is ${confidence?.level || 'strong'} with a sealed boundary and long horizon, so we can advance confidently`,
    };
  }
  return {
    verdict: 'proceed',
    allowForward: true,
    reason: `guidance is stable enough to move forward, but keep the mainline under watch`,
  };
}
