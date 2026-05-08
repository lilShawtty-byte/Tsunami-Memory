import type { TsunamiStormSelection, TsunamiStormCoverage } from './types';

export function buildStormCoverage(input: {
  stormSelection?: TsunamiStormSelection;
  selectedSignals: number;
  totalSignals: number;
  selectedEvidence: number;
  totalEvidence: number;
  selectedRelations: number;
  totalRelations: number;
}): TsunamiStormCoverage | undefined {
  const totals = [
    input.totalSignals,
    input.totalEvidence,
    input.totalRelations,
  ];
  if (!totals.some((value) => value > 0)) return undefined;

  const signalRatio = input.totalSignals > 0 ? input.selectedSignals / input.totalSignals : 1;
  const evidenceRatio = input.totalEvidence > 0 ? input.selectedEvidence / input.totalEvidence : 1;
  const relationRatio = input.totalRelations > 0 ? input.selectedRelations / input.totalRelations : 1;
  const score = Number(((signalRatio + evidenceRatio + relationRatio) / 3).toFixed(2));
  const mode = score >= 0.95 ? 'full' : score >= 0.72 ? 'broad' : score >= 0.45 ? 'focused' : 'narrow';

  const weakest =
    signalRatio <= evidenceRatio && signalRatio <= relationRatio ? 'signal lane'
      : evidenceRatio <= relationRatio ? 'evidence lane'
        : 'relation lane';
  const reason = input.stormSelection
    ? `${input.stormSelection.profile} selection currently covers ${weakest} most narrowly`
    : `current storm coverage is most limited by the ${weakest}`;

  return {
    mode,
    score,
    selectedSignals: input.selectedSignals,
    totalSignals: input.totalSignals,
    selectedEvidence: input.selectedEvidence,
    totalEvidence: input.totalEvidence,
    selectedRelations: input.selectedRelations,
    totalRelations: input.totalRelations,
    reason,
  };
}
