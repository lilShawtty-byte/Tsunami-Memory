// Storm center — supporting basin analysis
import { classifyTsunamiText } from '../tsunami_classifier';
import type { DurableRecoveryRecord } from '../runtime/checkpoints/durable_recovery';
import type { TsunamiStormCenter } from './types';

export function buildSupportingBasins(input: {
  flow: TsunamiStormCenter['flow'];
  anchors: TsunamiStormCenter['anchors'];
  recovery: DurableRecoveryRecord | null;
  evidence: TsunamiStormCenter['evidence'];
  issues: TsunamiStormCenter['issues'];
  repairSuggestions: TsunamiStormCenter['repairSuggestions'];
}) {
  const basinMap = new Map<string, { energy: number; drivers: Set<string> }>();
  const add = (basin: string, energy: number, driver: string) => {
    const key = String(basin || '').trim();
    if (!key) return;
    const entry = basinMap.get(key) ?? { energy: 0, drivers: new Set<string>() };
    entry.energy += Math.max(0, energy);
    if (driver) entry.drivers.add(driver);
    basinMap.set(key, entry);
  };
  const classifyInto = (text: string, baseEnergy: number, driver: string) => {
    const normalized = String(text || '').trim();
    if (!normalized) return;
    const classification = classifyTsunamiText(normalized);
    add(classification.basin, baseEnergy * Math.max(0.35, classification.confidence), `${driver}:${classification.current}`);
  };

  add(input.flow.basin, 0.7 + input.flow.confidence * 0.3, `focus:${input.flow.current}`);

  for (const anchor of input.anchors.slice(0, 2)) {
    classifyInto(`${anchor.title}\n${anchor.summary}`, 0.42 + Math.min(0.18, anchor.confidence * 0.15), 'anchor');
  }
  if (input.recovery) {
    classifyInto(`${input.recovery.note || ''}\n${input.recovery.source || ''}`, 0.24, 'recovery');
  }
  for (const snippet of input.evidence.slice(0, 2)) {
    classifyInto(`${snippet.title || ''}\n${snippet.quote || ''}`, 0.28, 'evidence');
  }
  for (const suggestion of input.repairSuggestions.slice(0, 2)) {
    const weight = suggestion.priority === 'P0' ? 0.46 : suggestion.priority === 'P1' ? 0.36 : 0.28;
    classifyInto(`${suggestion.title}\n${suggestion.detail || ''}`, weight, 'repair');
  }
  for (const issue of input.issues.slice(0, 2)) {
    const weight = issue.severity === 'high' ? 0.42 : issue.severity === 'medium' ? 0.32 : 0.24;
    classifyInto(`${issue.code}\n${issue.detail || ''}`, weight, 'issue');
  }

  return Array.from(basinMap.entries())
    .map(([basin, entry]) => ({
      basin,
      energy: Number(entry.energy.toFixed(2)),
      drivers: Array.from(entry.drivers).slice(0, 3),
    }))
    .sort((a, b) => b.energy - a.energy || a.basin.localeCompare(b.basin))
    .slice(0, 3);
}
