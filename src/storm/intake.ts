import type { TsunamiStormSelection, TsunamiStormCoverage, TsunamiStormSaturation, TsunamiStormBudget, TsunamiStormGate, TsunamiStormIntake } from './types';

export function buildStormIntake(input: {
  stormSelection?: TsunamiStormSelection;
  stormCoverage?: TsunamiStormCoverage;
  stormSaturation?: TsunamiStormSaturation;
  stormBudget?: TsunamiStormBudget;
  stormGate?: TsunamiStormGate;
}): TsunamiStormIntake | undefined {
  const selection = input.stormSelection;
  const coverage = input.stormCoverage;
  const saturation = input.stormSaturation;
  const budget = input.stormBudget;
  const gate = input.stormGate;
  if (!selection && !coverage && !saturation && !budget && !gate) return undefined;

  const nextSignalLimit = Math.max(1, selection?.signalLimit ?? 3);
  const nextEvidenceLimit = Math.max(1, selection?.evidenceLimit ?? 2);
  const nextRelationLimit = Math.max(1, selection?.relationLimit ?? 6);

  if (gate?.verdict === 'hold' || budget?.mode === 'frozen') {
    return {
      mode: 'hold',
      target: 'balanced',
      nextSignalLimit,
      nextEvidenceLimit,
      nextRelationLimit,
      reason: budget?.reason || gate?.reason || 'hold the intake steady until the storm is safe to widen again',
    };
  }

  if (saturation && saturation.hitLanes.length > 0) {
    const target: TsunamiStormIntake['target'] =
      saturation.hitLanes.length > 1 ? 'balanced' : saturation.hitLanes[0];
    const bump = saturation.level === 'saturated' ? 2 : 1;
    return {
      mode: saturation.level === 'saturated' ? 'widen' : 'rebalance',
      target,
      nextSignalLimit: target === 'signals' || target === 'balanced' ? nextSignalLimit + bump : nextSignalLimit,
      nextEvidenceLimit: target === 'evidence' || target === 'balanced' ? nextEvidenceLimit + bump : nextEvidenceLimit,
      nextRelationLimit:
        target === 'relations'
        ? nextRelationLimit + bump * 2
        : target === 'balanced'
          ? nextRelationLimit + bump
          : nextRelationLimit,
      reason: saturation.reason,
    };
  }

  const signalRatio = coverage && coverage.totalSignals > 0 ? coverage.selectedSignals / coverage.totalSignals : 1;
  const evidenceRatio = coverage && coverage.totalEvidence > 0 ? coverage.selectedEvidence / coverage.totalEvidence : 1;
  const relationRatio = coverage && coverage.totalRelations > 0 ? coverage.selectedRelations / coverage.totalRelations : 1;

  let target: TsunamiStormIntake['target'] = 'balanced';
  if (signalRatio <= evidenceRatio && signalRatio <= relationRatio) target = 'signals';
  else if (evidenceRatio <= relationRatio) target = 'evidence';
  else target = 'relations';

  if ((coverage?.score ?? 1) >= 0.9) {
    return {
      mode: 'steady',
      target: 'balanced',
      nextSignalLimit,
      nextEvidenceLimit,
      nextRelationLimit,
      reason: 'coverage is already strong enough, so keep the intake steady around the current storm surface',
    };
  }

  const bump = coverage && coverage.score < 0.45 ? 2 : 1;
  return {
    mode: coverage && coverage.score < 0.6 ? 'widen' : 'rebalance',
    target,
    nextSignalLimit: target === 'signals' ? nextSignalLimit + bump : nextSignalLimit,
    nextEvidenceLimit: target === 'evidence' ? nextEvidenceLimit + bump : nextEvidenceLimit,
    nextRelationLimit: target === 'relations' ? nextRelationLimit + bump * 2 : nextRelationLimit,
    reason: coverage?.reason || `${selection?.profile || 'current'} intake should rebalance toward ${target}`,
  };
}
