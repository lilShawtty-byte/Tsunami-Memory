import type { TsunamiStormCenterCurrentMix, TsunamiStormCenterStormMode, TsunamiStormPressure } from './types';

export function buildStormPressure(input: {
  currentMix: TsunamiStormCenterCurrentMix[];
  stormMode?: TsunamiStormCenterStormMode;
  issues: TsunamiStormCenter['issues'];
  repairSuggestions: TsunamiStormCenter['repairSuggestions'];
  anchors: TsunamiStormCenter['anchors'];
  evidence: TsunamiStormCenter['evidence'];
  recovery: DurableRecoveryRecord | null;
}): TsunamiStormPressure | undefined {
  if (!input.currentMix.length) return undefined;
  const reasons: string[] = [];
  let score = 0.12;
  const dominant = input.currentMix[0];
  score += Math.min(0.24, dominant.energy * 0.16);
  reasons.push(`dominant:${dominant.kind}`);
  const highIssues = input.issues.filter((issue) => issue.severity === 'high').length;
  const mediumIssues = input.issues.filter((issue) => issue.severity === 'medium').length;
  if (highIssues > 0) {
    score += Math.min(0.24, highIssues * 0.12);
    reasons.push(`high_issue:${highIssues}`);
  } else if (mediumIssues > 0) {
    score += Math.min(0.16, mediumIssues * 0.08);
    reasons.push(`medium_issue:${mediumIssues}`);
  }
  const p0Repairs = input.repairSuggestions.filter((item) => item.priority === 'P0').length;
  const p1Repairs = input.repairSuggestions.filter((item) => item.priority === 'P1').length;
  if (p0Repairs > 0) {
    score += Math.min(0.22, p0Repairs * 0.11);
    reasons.push(`p0_repair:${p0Repairs}`);
  } else if (p1Repairs > 0) {
    score += Math.min(0.14, p1Repairs * 0.07);
    reasons.push(`p1_repair:${p1Repairs}`);
  }
  if (input.stormMode?.mixed) {
    score += 0.08;
    reasons.push('mixed');
  }
  if (input.recovery && Number(input.recovery.lineageDepth ?? 0) > 0) {
    score += Math.min(0.12, Number(input.recovery.lineageDepth ?? 0) * 0.03);
    reasons.push(`recovery_depth:${Number(input.recovery.lineageDepth ?? 0)}`);
  }
  const stabilizer = Math.min(0.12, input.anchors.length * 0.03 + input.evidence.length * 0.015);
  if (stabilizer > 0) {
    score -= stabilizer;
    reasons.push(`stabilizer:${stabilizer.toFixed(2)}`);
  }
  const normalized = Math.max(0, Math.min(1, Number(score.toFixed(2))));
  const level = normalized >= 0.74 ? 'critical' : normalized >= 0.52 ? 'rising' : normalized >= 0.28 ? 'steady' : 'calm';
  return {
    level,
    score: normalized,
    reasons: reasons.slice(0, 5),
  };
}
