import type { TsunamiStormBudget, TsunamiStormBoundary, TsunamiStormGate, TsunamiStormHorizon, TsunamiStormSelection } from './types';

export function buildStormSelection(input: {
  stormBudget?: TsunamiStormBudget;
  stormBoundary?: TsunamiStormBoundary;
  stormGate?: TsunamiStormGate;
  stormHorizon?: TsunamiStormHorizon;
}): TsunamiStormSelection | undefined {
  const budget = input.stormBudget;
  const boundary = input.stormBoundary;
  const gate = input.stormGate;
  const horizon = input.stormHorizon;
  if (!budget && !boundary && !gate && !horizon) return undefined;

  if (budget?.mode === 'frozen' || gate?.verdict === 'hold') {
    return {
      profile: 'frozen',
      signalLimit: 3,
      evidenceLimit: 1,
      relationLimit: 4,
      reason: budget?.reason || gate?.reason || 'hold the storm to the minimum observable surface while support stabilizes',
    };
  }
  if (budget?.mode === 'minimal' || boundary?.mode === 'spilling' || boundary?.mode === 'permeable') {
    return {
      profile: 'tight',
      signalLimit: 3,
      evidenceLimit: 2,
      relationLimit: 6,
      reason: budget?.reason || boundary?.reason || 'keep the storm tightly sampled while widening support carefully',
    };
  }
  if (budget?.mode === 'open' || gate?.verdict === 'expand' || (horizon?.steps || 0) >= 3) {
    return {
      profile: 'broad',
      signalLimit: 6,
      evidenceLimit: 5,
      relationLimit: 14,
      reason: budget?.reason || gate?.reason || horizon?.reason || 'support is strong enough to gather a wider storm surface',
    };
  }
  return {
    profile: 'focused',
    signalLimit: 4,
    evidenceLimit: 3,
    relationLimit: 10,
    reason: budget?.reason || 'hold a focused storm surface around the mainline while keeping enough support visible',
  };
}
