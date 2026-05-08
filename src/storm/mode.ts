import type { TsunamiStormCenterCurrentMix, TsunamiStormCenterStormMode } from './types';

export function buildStormMode(currentMix: TsunamiStormCenterCurrentMix[]): TsunamiStormCenterStormMode | undefined {
  if (!currentMix.length) return undefined;
  const dominant = currentMix[0];
  const totalEnergy = currentMix.reduce((sum, item) => sum + item.energy, 0);
  const dominance = totalEnergy > 0 ? Number((dominant.energy / totalEnergy).toFixed(2)) : 0;
  const mixed = dominance < 0.56;
  const base = dominant.kind === 'primary_thread' ? 'thread' : dominant.kind;
  const label = mixed
    ? `mixed-${base}`
    : (dominant.kind === 'repair' || dominant.kind === 'issue' || dominant.kind === 'evidence'
      ? `${base}-heavy`
      : `${base}-led`);
  return {
    label,
    dominantKind: dominant.kind,
    dominance,
    mixed,
  };
}
