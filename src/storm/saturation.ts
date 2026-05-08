import type { TsunamiStormSelection, TsunamiStormSaturation } from './types';

export function buildStormSaturation(input: {
  stormSelection?: TsunamiStormSelection;
  selectedSignals: number;
  totalSignals: number;
  selectedEvidence: number;
  totalEvidence: number;
  selectedRelations: number;
  totalRelations: number;
}): TsunamiStormSaturation | undefined {
  const selection = input.stormSelection;
  if (!selection) return undefined;

  const signalHitLimit =
    input.totalSignals > input.selectedSignals
    && input.selectedSignals >= selection.signalLimit;
  const evidenceHitLimit =
    input.totalEvidence > input.selectedEvidence
    && input.selectedEvidence >= selection.evidenceLimit;
  const relationHitLimit =
    input.totalRelations > input.selectedRelations
    && input.selectedRelations >= selection.relationLimit;

  const hitLanes: Array<'signals' | 'evidence' | 'relations'> = [];
  if (signalHitLimit) hitLanes.push('signals');
  if (evidenceHitLimit) hitLanes.push('evidence');
  if (relationHitLimit) hitLanes.push('relations');

  const level: TsunamiStormSaturation['level'] =
    hitLanes.length >= 2 ? 'saturated' : hitLanes.length === 1 ? 'near_limit' : 'clear';
  const reason =
    hitLanes.length > 0
      ? `${hitLanes.join(', ')} lane${hitLanes.length > 1 ? 's' : ''} hit the current storm caps while more support stayed outside the center`
      : 'selected storm surface still fits within current storm caps';

  return {
    level,
    signalHitLimit,
    evidenceHitLimit,
    relationHitLimit,
    hitLanes,
    reason,
  };
}
