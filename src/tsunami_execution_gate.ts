import { buildTsunamiStormCenter, type TsunamiStormCenter } from './tsunami_storm_center';

function isHarnessLikeProjectDir(projectDir: string | undefined): boolean {
  const normalized = String(projectDir ?? '').replace(/\\/g, '/').trim();
  if (!normalized) return false;
  return normalized.startsWith('/tmp/ats-')
    || normalized.startsWith('/private/tmp/ats-')
    || normalized.includes('/.ats/artifacts/evals/')
    || normalized.includes('/.ats/artifacts/test_runtime/')
    || normalized.includes('/.ats/artifacts/bench/')
    || normalized.includes('/.ats/artifacts/release_pressure/')
    || normalized.includes('runtime-harness');
}

export type TsunamiExecutionGate = {
  gateVerdict: 'hold' | 'guarded' | 'proceed' | 'expand' | 'unknown';
  budgetMode: 'frozen' | 'minimal' | 'guided' | 'open' | 'unknown';
  budgetSteps: number;
  selectionProfile: 'frozen' | 'tight' | 'focused' | 'broad' | 'unknown';
  saturationLevel: 'clear' | 'near_limit' | 'saturated' | 'unknown';
  saturationLanes: Array<'signals' | 'evidence' | 'relations'>;
  signalLimit: number;
  evidenceLimit: number;
  relationLimit: number;
  intakeMode: 'hold' | 'rebalance' | 'widen' | 'steady' | 'unknown';
  intakeTarget: 'signals' | 'evidence' | 'relations' | 'balanced' | 'unknown';
  nextSignalLimit: number;
  nextEvidenceLimit: number;
  nextRelationLimit: number;
  allowDelegation: boolean;
  maxDelegationParallel: number;
  actionLabel?: string;
  actionTarget?: string;
  readinessLevel?: string;
  boundaryMode?: string;
  reason: string;
};

export type TsunamiExecutionGateToolResult = {
  blocked: boolean;
  reason?: string;
  args: Record<string, unknown>;
  notes: string[];
};

export function deriveTsunamiLoopStepLimit(baseMaxSteps: number, gate: TsunamiExecutionGate | null): number {
  const normalizedBase = Math.max(1, Math.floor(Number(baseMaxSteps) || 1));
  if (!gate) return normalizedBase;

  let gateSteps = Math.max(0, Math.floor(Number(gate.budgetSteps) || 0));
  if (gate.budgetMode === 'frozen' || gate.gateVerdict === 'hold') {
    gateSteps = 1;
  } else if (gateSteps <= 0) {
    if (gate.budgetMode === 'minimal') gateSteps = Math.min(3, normalizedBase);
    else if (gate.budgetMode === 'guided') gateSteps = Math.min(12, normalizedBase);
    else if (gate.budgetMode === 'open') gateSteps = normalizedBase;
    else gateSteps = normalizedBase; // Unknown mode: trust base config, don't cripple
  }

  return Math.max(1, Math.min(normalizedBase, gateSteps));
}

function clampPositive(value: unknown, fallback: number): number {
  const num = Number(value);
  if (!Number.isFinite(num)) return fallback;
  return Math.max(1, Math.floor(num));
}

function deriveSelectionLimits(center: TsunamiStormCenter) {
  const selection = center.stormSelection;
  const intake = center.stormIntake;
  let signalLimit = clampPositive(selection?.signalLimit, 3);
  let evidenceLimit = clampPositive(selection?.evidenceLimit, 2);
  let relationLimit = clampPositive(selection?.relationLimit, 6);

  if (intake?.mode === 'widen') {
    if (intake.target === 'signals' || intake.target === 'balanced') signalLimit = Math.max(signalLimit, clampPositive(intake.nextSignalLimit, signalLimit));
    if (intake.target === 'evidence' || intake.target === 'balanced') evidenceLimit = Math.max(evidenceLimit, clampPositive(intake.nextEvidenceLimit, evidenceLimit));
    if (intake.target === 'relations' || intake.target === 'balanced') relationLimit = Math.max(relationLimit, clampPositive(intake.nextRelationLimit, relationLimit));
  } else if (intake?.mode === 'rebalance') {
    if (intake.target === 'signals' || intake.target === 'balanced') signalLimit = clampPositive(intake.nextSignalLimit, signalLimit);
    if (intake.target === 'evidence' || intake.target === 'balanced') evidenceLimit = clampPositive(intake.nextEvidenceLimit, evidenceLimit);
    if (intake.target === 'relations' || intake.target === 'balanced') relationLimit = clampPositive(intake.nextRelationLimit, relationLimit);
  } else if (intake?.mode === 'hold') {
    signalLimit = Math.min(signalLimit, clampPositive(intake.nextSignalLimit, signalLimit));
    evidenceLimit = Math.min(evidenceLimit, clampPositive(intake.nextEvidenceLimit, evidenceLimit));
    relationLimit = Math.min(relationLimit, clampPositive(intake.nextRelationLimit, relationLimit));
  }

  return { signalLimit, evidenceLimit, relationLimit };
}

function deriveMaxDelegationParallel(center: TsunamiStormCenter): number {
  const gateVerdict = String(center.stormGate?.verdict ?? '');
  const budgetMode = String(center.stormBudget?.mode ?? '');
  const selectionProfile = String(center.stormSelection?.profile ?? '');
  const intakeMode = String(center.stormIntake?.mode ?? '');
  const saturationLevel = String(center.stormSaturation?.level ?? '');

  if (gateVerdict === 'hold' || budgetMode === 'frozen') return 1;
  if (saturationLevel === 'saturated') return 1;
  if (budgetMode === 'minimal' || selectionProfile === 'tight' || intakeMode === 'hold') return 1;
  if (saturationLevel === 'near_limit' && (intakeMode === 'rebalance' || selectionProfile === 'focused')) return 1;
  if (budgetMode === 'guided' || selectionProfile === 'focused' || intakeMode === 'rebalance' || intakeMode === 'steady') return 2;
  if (gateVerdict === 'expand' || budgetMode === 'open' || selectionProfile === 'broad' || intakeMode === 'widen') return 3;
  return 2;
}

export function buildTsunamiExecutionGate(input: {
  projectDir?: string;
  sessionId?: string;
  query?: string;
}): TsunamiExecutionGate | null {
  if (!input.projectDir?.trim()) return null;
  if (isHarnessLikeProjectDir(input.projectDir)) return null;
  // Skip gate for projects without TSUNAMI data
  const { existsSync } = require('fs');
  const { join } = require('path');
  const hasData = existsSync(join(input.projectDir, '.tsunami')) || existsSync(join(input.projectDir, 'README.md'));
  if (!hasData) return null;
  const center = buildTsunamiStormCenter({
    projectDir: input.projectDir,
    sessionId: input.sessionId,
    query: input.query || 'continue this project',
    refreshGraph: false,
    signalLimit: 3,
    evidenceLimit: 2,
    relationLimit: 6,
  });
  // Default to 'proceed'/'open' for unknown/unfamiliar projects — don't cripple execution
  const rawVerdict = String(center.stormGate?.verdict ?? '');
  const rawBudgetMode = String(center.stormBudget?.mode ?? '');
  const gateVerdict: TsunamiExecutionGate['gateVerdict'] =
    (rawVerdict === 'hold' || rawVerdict === 'guarded' || rawVerdict === 'proceed' || rawVerdict === 'expand')
      ? rawVerdict : 'proceed';
  const budgetMode: TsunamiExecutionGate['budgetMode'] =
    (rawBudgetMode === 'frozen' || rawBudgetMode === 'minimal' || rawBudgetMode === 'guided' || rawBudgetMode === 'open')
      ? rawBudgetMode : 'open';
  const selectionProfile = String(center.stormSelection?.profile ?? 'unknown') as TsunamiExecutionGate['selectionProfile'];
  const saturationLevel = String(center.stormSaturation?.level ?? 'unknown') as TsunamiExecutionGate['saturationLevel'];
  const intakeMode = String(center.stormIntake?.mode ?? 'unknown') as TsunamiExecutionGate['intakeMode'];
  const intakeTarget = String(center.stormIntake?.target ?? 'unknown') as TsunamiExecutionGate['intakeTarget'];
  const limits = deriveSelectionLimits(center);
  const allowDelegation = gateVerdict !== 'hold' && budgetMode !== 'frozen';
  const maxDelegationParallel = deriveMaxDelegationParallel(center);
  const reason = [
    center.stormGate?.reason,
    center.stormBudget?.reason,
    center.stormSelection?.reason,
    center.stormIntake?.reason,
  ].map((item) => String(item ?? '').trim()).find(Boolean) || 'storm gate requires a tighter execution surface';

  return {
    gateVerdict,
    budgetMode,
    budgetSteps: Math.max(0, Math.floor(Number(center.stormBudget?.steps ?? 0))),
    selectionProfile,
    saturationLevel,
    saturationLanes: Array.isArray(center.stormSaturation?.hitLanes)
      ? center.stormSaturation.hitLanes.filter((item): item is 'signals' | 'evidence' | 'relations' => ['signals', 'evidence', 'relations'].includes(String(item)))
      : [],
    signalLimit: limits.signalLimit,
    evidenceLimit: limits.evidenceLimit,
    relationLimit: limits.relationLimit,
    intakeMode,
    intakeTarget,
    nextSignalLimit: clampPositive(center.stormIntake?.nextSignalLimit, limits.signalLimit),
    nextEvidenceLimit: clampPositive(center.stormIntake?.nextEvidenceLimit, limits.evidenceLimit),
    nextRelationLimit: clampPositive(center.stormIntake?.nextRelationLimit, limits.relationLimit),
    allowDelegation,
    maxDelegationParallel,
    actionLabel: String(center.stormAction?.label ?? '').trim() || undefined,
    actionTarget: String(center.stormAction?.target ?? '').trim() || undefined,
    readinessLevel: String(center.stormReadiness?.level ?? '').trim() || undefined,
    boundaryMode: String(center.stormBoundary?.mode ?? '').trim() || undefined,
    reason,
  };
}

export function formatTsunamiExecutionGateSummary(gate: TsunamiExecutionGate | null): string {
  if (!gate) return 'tsunami execution gate unavailable';
  return [
    `gate=${gate.gateVerdict}`,
    `budget=${gate.budgetMode}:${gate.budgetSteps}`,
    `selection=${gate.selectionProfile}:${gate.signalLimit}/${gate.evidenceLimit}/${gate.relationLimit}`,
    `saturation=${gate.saturationLevel}:${gate.saturationLanes.join('|') || 'clear'}`,
    `intake=${gate.intakeMode}:${gate.intakeTarget}:${gate.nextSignalLimit}/${gate.nextEvidenceLimit}/${gate.nextRelationLimit}`,
    `delegation=${gate.allowDelegation ? `allow:${gate.maxDelegationParallel}` : 'hold'}`,
  ].join(' · ');
}

export function applyTsunamiExecutionGateToTool(
  tool: string,
  args: Record<string, unknown> | undefined,
  gate: TsunamiExecutionGate | null,
): TsunamiExecutionGateToolResult {
  const nextArgs = { ...(args || {}) };
  if (!gate) return { blocked: false, args: nextArgs, notes: [] };
  const notes: string[] = [];

  if (tool === 'delegate_task' || tool === 'swarm_run') {
    if (!gate.allowDelegation) {
      return {
        blocked: true,
        reason: `TSUNAMI gate=${gate.gateVerdict} budget=${gate.budgetMode}; tighten storm surface first using ${gate.actionLabel || 'mainline repair'}, then decide whether to expand delegation.${gate.reason ? ` ${gate.reason}` : ''}`.trim(),
        args: nextArgs,
        notes,
      };
    }
    const currentParallel = clampPositive(nextArgs.max_parallel, tool === 'swarm_run' ? 3 : 2);
    const clampedParallel = Math.min(currentParallel, gate.maxDelegationParallel);
    if (clampedParallel !== currentParallel) {
      nextArgs.max_parallel = clampedParallel;
      notes.push(`TSUNAMI execution gate reduced ${tool} max_parallel from ${currentParallel} to ${clampedParallel}`);
    }
  }

  if (tool === 'tsunami' && String(nextArgs.cmd ?? '').trim() === 'storm_center') {
    const currentSignals = clampPositive(nextArgs.signal_limit, gate.signalLimit);
    const currentEvidence = clampPositive(nextArgs.evidence_limit, gate.evidenceLimit);
    const currentRelations = clampPositive(nextArgs.relation_limit, gate.relationLimit);
    const nextSignals = Math.min(currentSignals, gate.signalLimit);
    const nextEvidence = Math.min(currentEvidence, gate.evidenceLimit);
    const nextRelations = Math.min(currentRelations, gate.relationLimit);
    nextArgs.signal_limit = nextSignals;
    nextArgs.evidence_limit = nextEvidence;
    nextArgs.relation_limit = nextRelations;
    notes.push(`TSUNAMI execution gate constrained storm_center to ${nextSignals}/${nextEvidence}/${nextRelations}`);
  }

  return { blocked: false, args: nextArgs, notes };
}
