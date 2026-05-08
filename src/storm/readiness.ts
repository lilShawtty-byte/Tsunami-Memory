import type { DurableRecoveryRecord } from '../runtime/checkpoints/durable_recovery';
import type { TsunamiStormReadiness, TsunamiStormCenter } from './types';

export function buildStormReadiness(input: {
  hasMainline: boolean;
  anchors: TsunamiStormCenter['anchors'];
  evidence: TsunamiStormCenter['evidence'];
  recovery: DurableRecoveryRecord | null;
  graphEdges: number;
}): TsunamiStormReadiness {
  let score = 0;
  const gaps: string[] = [];
  if (input.hasMainline) score += 0.24;
  else gaps.push('mainline');
  if (input.anchors.length > 0) score += Math.min(0.24, 0.14 + input.anchors.length * 0.05);
  else gaps.push('anchor');
  if (input.evidence.length > 0) score += Math.min(0.18, 0.1 + input.evidence.length * 0.03);
  else gaps.push('evidence');
  if (input.recovery) score += 0.12;
  else gaps.push('recovery');
  if (input.graphEdges >= 4) score += 0.14;
  else gaps.push('graph');
  const normalized = Math.max(0, Math.min(1, Number(score.toFixed(2))));
  const level = normalized >= 0.82 ? 'fortified' : normalized >= 0.58 ? 'ready' : normalized >= 0.32 ? 'partial' : 'weak';
  return {
    level,
    score: normalized,
    gaps: gaps.slice(0, 4),
  };
}
