// Storm center — signal analysis
import { clampEnergy, safeTrim, buildProjectNode, buildTaskThreadNode, buildHandoffNode, buildAnchorNode, buildRecoveryNode } from './helpers';
import type { StormCurrentKind, TsunamiStormCenterCurrent, TsunamiStormCenterCurrentMix, TsunamiStormCenter } from './types';

export function buildCurrents(input: {
  thread: ProjectTaskThread | null;
  handoff: ProjectHandoffRecord | null;
  anchors: TsunamiStormCenter['anchors'];
  recovery: DurableRecoveryRecord | null;
  evidence: TsunamiStormCenter['evidence'];
  issues: TsunamiStormCenter['issues'];
  repairSuggestions: TsunamiStormCenter['repairSuggestions'];
  signalLimit: number;
  fallbackMainlineTitle?: string;
  fallbackMainlineSummary?: string;
}): TsunamiStormCenterCurrent[] {
  const currents: TsunamiStormCenterCurrent[] = [];
  if (input.thread) {
    currents.push({
      kind: 'primary_thread',
      label: input.thread.title,
      node: buildTaskThreadNode(input.thread.id),
      energy: clampEnergy(input.thread.status === 'doing' ? 1 : input.thread.status === 'blocked' ? 0.82 : 0.74),
      detail: safeTrim(input.thread.summary || input.thread.nextStep, 140),
    });
  }
  if (!input.thread && !input.handoff && input.fallbackMainlineTitle) {
    currents.push({
      kind: 'primary_thread',
      label: input.fallbackMainlineTitle,
      energy: 0.66,
      detail: safeTrim(input.fallbackMainlineSummary, 140),
    });
  }
  if (input.handoff) {
    currents.push({
      kind: 'handoff',
      label: input.handoff.task,
      node: buildHandoffNode(input.handoff.id),
      energy: clampEnergy(input.handoff.progressStatus === 'doing' ? 0.94 : 0.8),
      detail: safeTrim(input.handoff.nextStep || input.handoff.summary, 140),
    });
  }
  if (input.anchors[0]) {
    const anchor = input.anchors[0];
    currents.push({
      kind: 'anchor',
      label: anchor.title,
      node: buildAnchorNode(anchor.pageId),
      energy: clampEnergy(0.7 + Math.min(0.25, anchor.confidence * 0.2)),
      detail: safeTrim(anchor.summary, 140),
    });
  }
  if (input.recovery) {
    currents.push({
      kind: 'recovery',
      label: input.recovery.recoveryId,
      node: buildRecoveryNode(input.recovery.recoveryId),
      energy: clampEnergy(0.62 + Math.min(0.25, Number(input.recovery.lineageDepth ?? 0) * 0.06)),
      detail: safeTrim(input.recovery.note || input.recovery.source, 140),
    });
  }
  for (const suggestion of input.repairSuggestions.slice(0, input.signalLimit)) {
    currents.push({
      kind: 'repair',
      label: suggestion.title,
      energy: clampEnergy(suggestion.priority === 'P0' ? 0.88 : suggestion.priority === 'P1' ? 0.76 : 0.62),
      detail: safeTrim(suggestion.detail, 140),
    });
  }
  for (const issue of input.issues.slice(0, input.signalLimit)) {
    currents.push({
      kind: 'issue',
      label: issue.code,
      energy: clampEnergy(issue.severity === 'high' ? 0.84 : issue.severity === 'medium' ? 0.68 : 0.52),
      detail: safeTrim(issue.detail, 140),
    });
  }
  for (const snippet of input.evidence.slice(0, input.signalLimit)) {
    currents.push({
      kind: 'evidence',
      label: snippet.title,
      energy: 0.58,
      detail: safeTrim(snippet.quote, 140),
    });
  }
  return currents.sort((a, b) => b.energy - a.energy || a.kind.localeCompare(b.kind));
}
export function buildCurrentMix(currents: TsunamiStormCenterCurrent[]): TsunamiStormCenterCurrentMix[] {
  const kindMap = new Map<StormCurrentKind, { energy: number; count: number }>();
  for (const current of currents) {
    const entry = kindMap.get(current.kind) ?? { energy: 0, count: 0 };
    entry.energy += current.energy;
    entry.count += 1;
    kindMap.set(current.kind, entry);
  }
  return Array.from(kindMap.entries())
    .map(([kind, entry]) => ({
      kind,
      energy: Number(entry.energy.toFixed(2)),
      count: entry.count,
    }))
    .sort((a, b) => b.energy - a.energy || b.count - a.count || a.kind.localeCompare(b.kind))
    .slice(0, 4);
}
