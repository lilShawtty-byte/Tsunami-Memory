import { existsSync, readFileSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';

import {
  getProjectLatestHandoff,
  getProjectStateStatus,
  listProjectWikiPages,
  queryProjectWiki,
  resolveProjectTaskThread,
  type ProjectHandoffRecord,
  type ProjectTaskThread,
} from './core/project_state';
import { durableRecoveryStore, type DurableRecoveryRecord } from './runtime/checkpoints/durable_recovery';
import { auditMemoryFabric } from './memory_audit';
import { classifyTsunamiText } from './tsunami_classifier';
import { tsunamiGraphQueryEntity } from './tsunami_graph_runtime';
import { syncProjectRuntimeGraph, type TsunamiRuntimeGraphSyncSummary } from './tsunami_runtime_graph_sync';

type StormCurrentKind =
  | 'primary_thread'
  | 'handoff'
  | 'anchor'
  | 'recovery'
  | 'repair'
  | 'issue'
  | 'evidence';

export type TsunamiStormCenterCurrent = {
  kind: StormCurrentKind;
  label: string;
  node?: string;
  energy: number;
  detail?: string;
};

export type TsunamiStormCenterCurrentMix = {
  kind: StormCurrentKind;
  energy: number;
  count: number;
};

export type TsunamiStormCenterStormMode = {
  label: string;
  dominantKind: StormCurrentKind;
  dominance: number;
  mixed: boolean;
};

export type TsunamiStormPressure = {
  level: 'calm' | 'steady' | 'rising' | 'critical';
  score: number;
  reasons: string[];
};

export type TsunamiStormDirective = {
  label: string;
  lane: 'stabilize' | 'repair' | 'diagnose' | 'consolidate' | 'advance';
  reason: string;
};

export type TsunamiStormAction = {
  label: string;
  target?: string;
  reason: string;
};

export type TsunamiStormReadiness = {
  level: 'weak' | 'partial' | 'ready' | 'fortified';
  score: number;
  gaps: string[];
};

export type TsunamiStormBoundary = {
  mode: 'sealed' | 'guarded' | 'permeable' | 'spilling';
  expand: boolean;
  reason: string;
};

export type TsunamiStormHorizon = {
  label: 'single_step' | 'short_run' | 'two_step' | 'multi_step';
  steps: number;
  reason: string;
};

export type TsunamiStormConfidence = {
  level: 'low' | 'guarded' | 'confident' | 'high';
  score: number;
  reason: string;
};

export type TsunamiStormGate = {
  verdict: 'hold' | 'guarded' | 'proceed' | 'expand';
  allowForward: boolean;
  reason: string;
};

export type TsunamiStormBudget = {
  mode: 'frozen' | 'minimal' | 'guided' | 'open';
  steps: number;
  reason: string;
};

export type TsunamiStormSelection = {
  profile: 'frozen' | 'tight' | 'focused' | 'broad';
  signalLimit: number;
  evidenceLimit: number;
  relationLimit: number;
  reason: string;
};

export type TsunamiStormCoverage = {
  mode: 'narrow' | 'focused' | 'broad' | 'full';
  score: number;
  selectedSignals: number;
  totalSignals: number;
  selectedEvidence: number;
  totalEvidence: number;
  selectedRelations: number;
  totalRelations: number;
  reason: string;
};

export type TsunamiStormSaturation = {
  level: 'clear' | 'near_limit' | 'saturated';
  signalHitLimit: boolean;
  evidenceHitLimit: boolean;
  relationHitLimit: boolean;
  hitLanes: Array<'signals' | 'evidence' | 'relations'>;
  reason: string;
};

export type TsunamiStormIntake = {
  mode: 'hold' | 'rebalance' | 'widen' | 'steady';
  target: 'signals' | 'evidence' | 'relations' | 'balanced';
  nextSignalLimit: number;
  nextEvidenceLimit: number;
  nextRelationLimit: number;
  reason: string;
};

export type TsunamiStormCenter = {
  projectDir: string;
  projectNode: string;
  query: string;
  focusQuery: string;
  refreshedGraph: boolean;
  syncSummary?: TsunamiRuntimeGraphSyncSummary | null;
  focus: {
    title: string;
    status?: string;
    summary?: string;
    nextStep?: string;
    featureId?: string;
  };
  flow: {
    basin: string;
    current: string;
    confidence: number;
  };
  supportingBasins: Array<{
    basin: string;
    energy: number;
    drivers: string[];
  }>;
  thread: ProjectTaskThread | null;
  handoff: ProjectHandoffRecord | null;
  recovery: DurableRecoveryRecord | null;
  anchors: Array<{
    pageId: string;
    title: string;
    summary: string;
    confidence: number;
    tags: string[];
  }>;
  evidence: ReturnType<typeof queryProjectWiki>['evidence'];
  graph: {
    project: Record<string, unknown>[];
    thread: Record<string, unknown>[];
    handoff: Record<string, unknown>[];
    anchor: Record<string, unknown>[];
    recovery: Record<string, unknown>[];
  };
  issues: ReturnType<typeof auditMemoryFabric>['issues'];
  repairSuggestions: ReturnType<typeof auditMemoryFabric>['repairSuggestions'];
  currents: TsunamiStormCenterCurrent[];
  currentMix: TsunamiStormCenterCurrentMix[];
  stormMode?: TsunamiStormCenterStormMode;
  stormPressure?: TsunamiStormPressure;
  stormDirective?: TsunamiStormDirective;
  stormAction?: TsunamiStormAction;
  stormReadiness?: TsunamiStormReadiness;
  stormBoundary?: TsunamiStormBoundary;
  stormHorizon?: TsunamiStormHorizon;
  stormConfidence?: TsunamiStormConfidence;
  stormGate?: TsunamiStormGate;
  stormBudget?: TsunamiStormBudget;
  stormSelection?: TsunamiStormSelection;
  stormCoverage?: TsunamiStormCoverage;
  stormSaturation?: TsunamiStormSaturation;
  stormIntake?: TsunamiStormIntake;
  topRepair?: {
    title: string;
    priority?: string;
    detail?: string;
  };
  topIssue?: {
    code: string;
    severity?: string;
    detail?: string;
  };
  metrics: {
    issueCount: number;
    repairCount: number;
    evidenceCount: number;
    anchorCount: number;
    graphEdges: number;
    recoveryDepth: number;
  };
};

type BuildStormCenterOpts = {
  projectDir?: string;
  query?: string;
  sessionId?: string;
  refreshGraph?: boolean;
  evidenceLimit?: number;
  signalLimit?: number;
  relationLimit?: number;
};

type TsunamiFallbackDocSupport = {
  anchors: TsunamiStormCenter['anchors'];
  evidence: TsunamiStormCenter['evidence'];
  mainlineTitle?: string;
  mainlineSummary?: string;
};

const TSUNAMI_STORM_RETRY_DELAYS_MS = [8, 18, 36] as const;

function buildProjectNode(projectDir: string): string {
  return `project:${basename(projectDir) || projectDir}`;
}

function buildTaskThreadNode(threadId: string): string {
  return `task_thread:${threadId}`;
}

function buildHandoffNode(handoffId: string): string {
  return `handoff:${handoffId}`;
}

function buildAnchorNode(pageId: string): string {
  return `recovery_anchor:${pageId}`;
}

function buildRecoveryNode(recoveryId: string): string {
  return `recovery_record:${recoveryId}`;
}

function clampEnergy(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, Number(value.toFixed(2))));
}

function safeTrim(value: string | undefined, max = 160): string {
  const text = String(value ?? '').replace(/\s+/g, ' ').trim();
  if (!text) return '';
  return text.length > max ? `${text.slice(0, max)}...` : text;
}

function blockForRetry(ms: number) {
  const delay = Math.max(0, Math.floor(ms));
  if (!delay) return;
  try {
    const shared = new SharedArrayBuffer(4);
    Atomics.wait(new Int32Array(shared), 0, 0, delay);
  } catch {
    const end = Date.now() + delay;
    while (Date.now() < end) {
      // Busy wait fallback for runtimes where Atomics.wait is unavailable.
    }
  }
}

export function isTsunamiStormRetryableError(error: unknown): boolean {
  const message = String((error as any)?.message || error || '').toLowerCase();
  if (!message) return false;
  return message.includes('database is locked')
    || message.includes('sqlite_busy')
    || message.includes('sql_busy')
    || message.includes('busy timeout');
}

export function withTsunamiStormRetry<T>(runner: () => T): T {
  let lastError: unknown;
  for (let attempt = 0; attempt <= TSUNAMI_STORM_RETRY_DELAYS_MS.length; attempt += 1) {
    try {
      return runner();
    } catch (error) {
      lastError = error;
      if (!isTsunamiStormRetryableError(error) || attempt >= TSUNAMI_STORM_RETRY_DELAYS_MS.length) {
        throw error;
      }
      blockForRetry(TSUNAMI_STORM_RETRY_DELAYS_MS[attempt]);
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError || 'unknown storm retry failure'));
}

function pickFocusQuery(input: {
  query?: string;
  thread: ProjectTaskThread | null;
  handoff: ProjectHandoffRecord | null;
  activeFeatureTitle?: string;
}): string {
  const direct = String(input.query ?? '').trim();
  if (direct) return direct;
  return (
    input.thread?.title
    || input.handoff?.task
    || input.activeFeatureTitle
    || 'current mainline'
  );
}

function tokenizeStormSupportQuery(query: string): string[] {
  return String(query || '')
    .toLowerCase()
    .split(/[\s,，。;；:：|/\\()\[\]{}"']+/)
    .map((item) => item.trim())
    .filter((item) => item.length >= 2);
}

function pickFallbackDocSnippet(content: string, query: string, max = 180): string {
  const lines = String(content || '')
    .split('\n')
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .filter((line) => !/^#+\s*/.test(line));
  if (!lines.length) return '';
  const tokens = tokenizeStormSupportQuery(query);
  if (tokens.length > 0) {
    const matched = lines.find((line) => tokens.some((token) => line.toLowerCase().includes(token)));
    if (matched) return safeTrim(matched, max);
  }
  return safeTrim(lines.find((line) => line.length >= 20) || lines[0], max);
}

function buildFallbackDocStormSupport(projectDir: string, focusQuery: string, limit = 2): TsunamiFallbackDocSupport {
  const candidates = [
    join(projectDir, 'README.md'),
    join(projectDir, 'CHANGELOG.md'),
    join(projectDir, 'README.md'),
  ];
  const anchors: TsunamiStormCenter['anchors'] = [];
  const evidence: TsunamiStormCenter['evidence'] = [];
  let mainlineTitle: string | undefined;
  let mainlineSummary: string | undefined;

  for (const filePath of candidates) {
    if (!existsSync(filePath)) continue;
    let content = '';
    try {
      content = readFileSync(filePath, 'utf8');
    } catch (error: any) {
      console.warn(`[TSUNAMI] failed to read fallback storm support doc ${filePath}:`, error?.message ?? error);
      continue;
    }
    const snippet = pickFallbackDocSnippet(content, focusQuery);
    if (!snippet) continue;
    const label = basename(filePath);
    if (!mainlineTitle) {
      mainlineTitle = `Project Mainline / ${label}`;
      mainlineSummary = snippet;
    }
    if (anchors.length < 1 && label === 'README.md') {
      anchors.push({
        pageId: `storm-fallback-anchor:${label}`,
        title: `Fallback Anchor / ${label}`,
        summary: snippet,
        confidence: 0.54,
        tags: ['storm-fallback', 'project-doc'],
      });
    }
    if (evidence.length < limit) {
      evidence.push({
        snippetId: `storm-fallback-evidence:${label}:${evidence.length + 1}`,
        pageId: `storm-fallback-doc:${label}`,
        title: `Fallback Evidence / ${label}`,
        sourcePath: filePath,
        sourceRef: `file:${label}`,
        quote: snippet,
        tags: ['storm-fallback', 'project-doc'],
      });
    }
  }

  return {
    anchors,
    evidence,
    mainlineTitle,
    mainlineSummary,
  };
}

function readAnchorCandidates(projectDir: string, featureId?: string, limit = 3) {
  const pages = listProjectWikiPages(projectDir, 12)
    .filter((page) => page.title.startsWith('Recovery Anchor /') || page.tags.includes('recovery-anchor'))
    .filter((page) => {
      if (!featureId) return true;
      return page.sourceRefs.some((ref) => ref.toLowerCase() === `feature_id:${featureId.toLowerCase()}`);
    })
    .sort((a, b) => b.updatedAt - a.updatedAt);
  return pages.slice(0, limit);
}

function buildCurrents(input: {
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

function buildCurrentMix(currents: TsunamiStormCenterCurrent[]): TsunamiStormCenterCurrentMix[] {
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

function buildStormMode(currentMix: TsunamiStormCenterCurrentMix[]): TsunamiStormCenterStormMode | undefined {
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

function buildStormPressure(input: {
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

function buildStormDirective(input: {
  stormPressure?: TsunamiStormPressure;
  stormMode?: TsunamiStormCenterStormMode;
  topRepair?: TsunamiStormCenter['topRepair'];
  topIssue?: TsunamiStormCenter['topIssue'];
  focus: TsunamiStormCenter['focus'];
}): TsunamiStormDirective | undefined {
  const pressure = input.stormPressure;
  const mode = input.stormMode;
  if ((pressure?.level === 'critical' || pressure?.level === 'rising') && input.topRepair) {
    return {
      label: pressure.level === 'critical' ? 'stabilize-now' : 'stabilize-repair',
      lane: pressure.level === 'critical' ? 'stabilize' : 'repair',
      reason: `${pressure.level} pressure + ${input.topRepair.priority || 'repair'} ${input.topRepair.title}`.trim(),
    };
  }
  if ((pressure?.level === 'rising' || pressure?.level === 'critical') && input.topIssue && !input.topRepair) {
    return {
      label: 'diagnose-drift',
      lane: 'diagnose',
      reason: `${pressure.level} pressure + issue ${input.topIssue.code}`.trim(),
    };
  }
  if (mode?.dominantKind === 'anchor' || mode?.dominantKind === 'evidence') {
    return {
      label: 'consolidate-context',
      lane: 'consolidate',
      reason: `${mode.label} requires clearer anchors and evidence`.trim(),
    };
  }
  if (mode?.dominantKind === 'issue') {
    return {
      label: 'diagnose-thread',
      lane: 'diagnose',
      reason: `${mode.label} suggests drift diagnosis before forward motion`.trim(),
    };
  }
  if (mode?.dominantKind === 'repair') {
    return {
      label: 'apply-repair',
      lane: 'repair',
      reason: `${mode.label} suggests closing the top repair path first`.trim(),
    };
  }
  return {
    label: 'advance-mainline',
    lane: 'advance',
    reason: input.focus.nextStep || input.focus.summary || 'mainline is ready to advance',
  };
}

function buildStormAction(input: {
  stormDirective?: TsunamiStormDirective;
  topRepair?: TsunamiStormCenter['topRepair'];
  topIssue?: TsunamiStormCenter['topIssue'];
  focus: TsunamiStormCenter['focus'];
}): TsunamiStormAction | undefined {
  const directive = input.stormDirective;
  if (!directive) return undefined;
  if (directive.lane === 'stabilize' && input.topRepair) {
    return {
      label: 'close top repair before expanding scope',
      target: input.topRepair.title,
      reason: directive.reason,
    };
  }
  if (directive.lane === 'repair' && input.topRepair) {
    return {
      label: 'apply the priority repair path',
      target: input.topRepair.title,
      reason: directive.reason,
    };
  }
  if (directive.lane === 'diagnose' && input.topIssue) {
    return {
      label: 'diagnose the dominant drift before coding forward',
      target: input.topIssue.detail || input.topIssue.code,
      reason: directive.reason,
    };
  }
  if (directive.lane === 'consolidate') {
    return {
      label: 'refresh anchors and evidence around the mainline',
      target: input.focus.title,
      reason: directive.reason,
    };
  }
  return {
    label: input.focus.nextStep || 'advance the mainline carefully',
    target: input.focus.title,
    reason: directive.reason,
  };
}

function buildStormReadiness(input: {
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

function buildStormBoundary(input: {
  stormPressure?: TsunamiStormPressure;
  stormReadiness?: TsunamiStormReadiness;
  stormMode?: TsunamiStormCenterStormMode;
  topRepair?: TsunamiStormCenter['topRepair'];
  topIssue?: TsunamiStormCenter['topIssue'];
  supportingBasins: Array<{ basin: string; energy: number; drivers: string[] }>;
}): TsunamiStormBoundary | undefined {
  const pressure = input.stormPressure;
  const readiness = input.stormReadiness;
  const mode = input.stormMode;
  if (!pressure && !readiness && !mode) return undefined;

  const seaMixCount = input.supportingBasins.length;
  const weakSupport = Boolean(readiness && (readiness.level === 'weak' || readiness.level === 'partial'));
  const strongSupport = Boolean(readiness && (readiness.level === 'ready' || readiness.level === 'fortified'));
  const severePressure = pressure?.level === 'critical' || pressure?.level === 'rising';
  const mixed = Boolean(mode?.mixed);
  const hasRepair = Boolean(input.topRepair);
  const hasIssue = Boolean(input.topIssue);

  if (pressure?.level === 'critical' || ((hasRepair || hasIssue) && severePressure && mixed)) {
    return {
      mode: 'spilling',
      expand: false,
      reason: `pressure ${pressure?.level || 'high'} with active drift/repair energy requires containment first`,
    };
  }
  if (weakSupport && seaMixCount <= 1) {
    return {
      mode: 'permeable',
      expand: true,
      reason: `support is ${readiness?.level || 'thin'} and sea mix is narrow, so widen anchors/evidence before pushing forward`,
    };
  }
  if (strongSupport && (pressure?.level === 'calm' || pressure?.level === 'steady') && !mixed) {
    return {
      mode: 'sealed',
      expand: false,
      reason: `support is ${readiness?.level || 'stable'} and pressure is ${pressure?.level || 'calm'}, so keep the storm tightly scoped`,
    };
  }
  return {
    mode: 'guarded',
    expand: false,
    reason: mixed
      ? 'mixed sea-state suggests holding the current lane until the dominant current is clearer'
      : 'boundary is mostly stable, but keep scope guarded while pressure and support finish converging',
  };
}

function buildStormHorizon(input: {
  stormPressure?: TsunamiStormPressure;
  stormReadiness?: TsunamiStormReadiness;
  stormBoundary?: TsunamiStormBoundary;
  stormMode?: TsunamiStormCenterStormMode;
  topRepair?: TsunamiStormCenter['topRepair'];
  topIssue?: TsunamiStormCenter['topIssue'];
}): TsunamiStormHorizon | undefined {
  const pressure = input.stormPressure;
  const readiness = input.stormReadiness;
  const boundary = input.stormBoundary;
  const mode = input.stormMode;
  if (!pressure && !readiness && !boundary && !mode) return undefined;

  if (pressure?.level === 'critical' || boundary?.mode === 'spilling') {
    return {
      label: 'single_step',
      steps: 1,
      reason: `pressure ${pressure?.level || 'critical'} and boundary ${boundary?.mode || 'open'} mean we should only plan the next safe move`,
    };
  }
  if (boundary?.expand || readiness?.level === 'weak' || readiness?.level === 'partial') {
    return {
      label: 'short_run',
      steps: 1,
      reason: `support is still ${readiness?.level || 'thin'}, so gather anchors/evidence before planning beyond the immediate step`,
    };
  }
  if (readiness?.level === 'fortified' && boundary?.mode === 'sealed' && !mode?.mixed && (pressure?.level === 'calm' || pressure?.level === 'steady')) {
    return {
      label: 'multi_step',
      steps: 3,
      reason: `support is fortified, boundary is sealed, and pressure is ${pressure?.level || 'calm'}, so the storm can safely see several steps ahead`,
    };
  }
  if (readiness?.level === 'ready' || boundary?.mode === 'guarded') {
    return {
      label: 'two_step',
      steps: 2,
      reason: `support is stable enough for the next two moves, but we should keep the mainline under watch`,
    };
  }
  return {
    label: 'short_run',
    steps: 1,
    reason: input.topRepair || input.topIssue
      ? 'active repair/drift pressure suggests holding planning to the immediate correction window'
      : 'storm support is still settling, so keep the planning window short',
  };
}

function buildStormConfidence(input: {
  stormPressure?: TsunamiStormPressure;
  stormReadiness?: TsunamiStormReadiness;
  stormBoundary?: TsunamiStormBoundary;
  stormHorizon?: TsunamiStormHorizon;
  stormMode?: TsunamiStormCenterStormMode;
}): TsunamiStormConfidence | undefined {
  const pressure = input.stormPressure;
  const readiness = input.stormReadiness;
  const boundary = input.stormBoundary;
  const horizon = input.stormHorizon;
  const mode = input.stormMode;
  if (!pressure && !readiness && !boundary && !horizon && !mode) return undefined;

  let score = 0.18;
  const reasons: string[] = [];

  if (readiness?.level === 'fortified') {
    score += 0.32;
    reasons.push('fortified support');
  } else if (readiness?.level === 'ready') {
    score += 0.22;
    reasons.push('ready support');
  } else if (readiness?.level === 'partial') {
    score += 0.08;
    reasons.push('partial support');
  } else if (readiness?.level === 'weak') {
    score -= 0.08;
    reasons.push('weak support');
  }

  if (boundary?.mode === 'sealed') {
    score += 0.16;
    reasons.push('sealed boundary');
  } else if (boundary?.mode === 'guarded') {
    score += 0.08;
    reasons.push('guarded boundary');
  } else if (boundary?.mode === 'permeable') {
    score -= 0.06;
    reasons.push('permeable boundary');
  } else if (boundary?.mode === 'spilling') {
    score -= 0.18;
    reasons.push('spilling boundary');
  }

  if (pressure?.level === 'calm') {
    score += 0.12;
    reasons.push('calm pressure');
  } else if (pressure?.level === 'steady') {
    score += 0.06;
    reasons.push('steady pressure');
  } else if (pressure?.level === 'rising') {
    score -= 0.08;
    reasons.push('rising pressure');
  } else if (pressure?.level === 'critical') {
    score -= 0.18;
    reasons.push('critical pressure');
  }

  if (mode?.mixed) {
    score -= 0.06;
    reasons.push('mixed sea-state');
  } else if (mode) {
    score += 0.04;
    reasons.push('coherent sea-state');
  }

  if (horizon?.label === 'multi_step') {
    score += 0.1;
    reasons.push('multi-step horizon');
  } else if (horizon?.label === 'two_step') {
    score += 0.05;
    reasons.push('two-step horizon');
  } else if (horizon?.label === 'single_step') {
    score -= 0.04;
    reasons.push('single-step horizon');
  }

  const normalized = Math.max(0, Math.min(1, Number(score.toFixed(2))));
  const level = normalized >= 0.74 ? 'high' : normalized >= 0.54 ? 'confident' : normalized >= 0.32 ? 'guarded' : 'low';
  return {
    level,
    score: normalized,
    reason: reasons.slice(0, 3).join(' · ') || 'confidence still settling',
  };
}

function buildStormGate(input: {
  stormPressure?: TsunamiStormPressure;
  stormReadiness?: TsunamiStormReadiness;
  stormConfidence?: TsunamiStormConfidence;
  stormBoundary?: TsunamiStormBoundary;
  stormHorizon?: TsunamiStormHorizon;
}): TsunamiStormGate | undefined {
  const pressure = input.stormPressure;
  const readiness = input.stormReadiness;
  const confidence = input.stormConfidence;
  const boundary = input.stormBoundary;
  const horizon = input.stormHorizon;
  if (!pressure && !readiness && !confidence && !boundary && !horizon) return undefined;

  if (pressure?.level === 'critical' || boundary?.mode === 'spilling' || confidence?.level === 'low') {
    return {
      verdict: 'hold',
      allowForward: false,
      reason: `hold the line until pressure/boundary/confidence stabilizes (${pressure?.level || boundary?.mode || confidence?.level || 'unknown'})`,
    };
  }
  if (boundary?.expand || readiness?.level === 'partial' || readiness?.level === 'weak') {
    return {
      verdict: 'guarded',
      allowForward: false,
      reason: `keep execution guarded while support is still ${readiness?.level || 'thin'} and the storm may need wider support`,
    };
  }
  if ((confidence?.level === 'high' || confidence?.level === 'confident') && boundary?.mode === 'sealed' && (horizon?.steps || 0) >= 3) {
    return {
      verdict: 'expand',
      allowForward: true,
      reason: `guidance is ${confidence?.level || 'strong'} with a sealed boundary and long horizon, so we can advance confidently`,
    };
  }
  return {
    verdict: 'proceed',
    allowForward: true,
    reason: `guidance is stable enough to move forward, but keep the mainline under watch`,
  };
}

function buildStormBudget(input: {
  stormGate?: TsunamiStormGate;
  stormHorizon?: TsunamiStormHorizon;
  stormReadiness?: TsunamiStormReadiness;
  stormConfidence?: TsunamiStormConfidence;
}): TsunamiStormBudget | undefined {
  const gate = input.stormGate;
  const horizon = input.stormHorizon;
  const readiness = input.stormReadiness;
  const confidence = input.stormConfidence;
  if (!gate && !horizon && !readiness && !confidence) return undefined;

  const horizonSteps = Math.max(0, Number(horizon?.steps || 0));
  if (gate?.verdict === 'hold') {
    return {
      mode: 'frozen',
      steps: 0,
      reason: gate.reason,
    };
  }
  if (gate?.verdict === 'guarded' || readiness?.level === 'weak' || readiness?.level === 'partial' || confidence?.level === 'guarded' || confidence?.level === 'low') {
    return {
      mode: 'minimal',
      steps: 1,
      reason: 'advance only the immediate correction move while support and confidence continue converging',
    };
  }
  if (gate?.verdict === 'expand' && (confidence?.level === 'high' || confidence?.level === 'confident')) {
    return {
      mode: 'open',
      steps: Math.max(2, Math.min(3, horizonSteps || 3)),
      reason: 'guidance is strong enough to approve a broader forward window',
    };
  }
  return {
    mode: 'guided',
    steps: Math.max(1, Math.min(2, horizonSteps || 2)),
    reason: 'advance with a bounded budget while keeping the mainline under active watch',
  };
}

function buildStormSelection(input: {
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

function buildStormCoverage(input: {
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

function buildStormSaturation(input: {
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

function buildStormIntake(input: {
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

function buildSupportingBasins(input: {
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

function buildTsunamiStormCenterOnce(opts: BuildStormCenterOpts = {}): TsunamiStormCenter {
  const projectDir = resolve(opts.projectDir || process.cwd());
  const status = getProjectStateStatus(projectDir);
  const query = String(opts.query ?? '').trim();
  const threadMatch = resolveProjectTaskThread(projectDir, query, 3);
  const thread = threadMatch.thread;
  const handoff = getProjectLatestHandoff(projectDir, {
    sessionId: opts.sessionId,
    featureId: thread?.featureId,
  }) ?? getProjectLatestHandoff(projectDir);
  const focusQuery = pickFocusQuery({
    query,
    thread,
    handoff,
    activeFeatureTitle: status.activeFeature?.title,
  });
  const docSupport = buildFallbackDocStormSupport(projectDir, focusQuery, Math.max(2, Math.min(8, opts.evidenceLimit ?? 4)));
  const wikiAnchors = readAnchorCandidates(projectDir, thread?.featureId, 3).map((page) => ({
    pageId: page.pageId,
    title: page.title,
    summary: page.summary,
    confidence: page.confidence,
    tags: page.tags,
  }));
  const anchors = wikiAnchors.length > 0 ? wikiAnchors : docSupport.anchors;
  const evidenceResult = queryProjectWiki(projectDir, focusQuery, Math.max(2, Math.min(8, opts.evidenceLimit ?? 4)));
  const evidence = evidenceResult.evidence.length > 0 ? evidenceResult.evidence : docSupport.evidence;
  const audit = auditMemoryFabric(projectDir);
  const recovery = durableRecoveryStore.latest({
    sessionId: opts.sessionId,
    projectDir,
  }) ?? durableRecoveryStore.latest({ projectDir });
  const refreshGraph = opts.refreshGraph !== false;
  const syncSummary = refreshGraph ? syncProjectRuntimeGraph(projectDir) : null;
  const requestedRelationLimit = Math.max(4, Math.min(24, opts.relationLimit ?? 10));
  const graph = {
    project: tsunamiGraphQueryEntity(buildProjectNode(projectDir), undefined, 'both').slice(0, requestedRelationLimit),
    thread: thread ? tsunamiGraphQueryEntity(buildTaskThreadNode(thread.id), undefined, 'both').slice(0, requestedRelationLimit) : [],
    handoff: handoff ? tsunamiGraphQueryEntity(buildHandoffNode(handoff.id), undefined, 'both').slice(0, requestedRelationLimit) : [],
    anchor: anchors[0] ? tsunamiGraphQueryEntity(buildAnchorNode(anchors[0].pageId), undefined, 'both').slice(0, requestedRelationLimit) : [],
    recovery: recovery ? tsunamiGraphQueryEntity(buildRecoveryNode(recovery.recoveryId), undefined, 'both').slice(0, requestedRelationLimit) : [],
  };
  const graphEdges = graph.project.length + graph.thread.length + graph.handoff.length + graph.anchor.length + graph.recovery.length;
  const requestedSignalLimit = Math.max(2, Math.min(6, opts.signalLimit ?? 4));
  const currents = buildCurrents({
    thread,
    handoff,
    anchors,
    recovery,
    evidence,
    issues: audit.issues,
    repairSuggestions: audit.repairSuggestions,
    signalLimit: requestedSignalLimit,
    fallbackMainlineTitle: !thread && !handoff && !status.activeFeature ? docSupport.mainlineTitle : undefined,
    fallbackMainlineSummary: !thread && !handoff && !status.activeFeature ? docSupport.mainlineSummary : undefined,
  });
  const currentMix = buildCurrentMix(currents);
  const stormMode = buildStormMode(currentMix);
  const stormPressure = buildStormPressure({
    currentMix,
    stormMode,
    issues: audit.issues,
    repairSuggestions: audit.repairSuggestions,
    anchors,
    evidence,
    recovery,
  });
  const flow = classifyTsunamiText([
    thread?.title || '',
    thread?.summary || '',
    handoff?.task || '',
    handoff?.summary || '',
    handoff?.nextStep || '',
    status.activeFeature?.title || '',
    status.activeFeature?.detail || '',
  ].filter(Boolean).join('\n'));
  const topRepair = audit.repairSuggestions[0]
    ? {
        title: audit.repairSuggestions[0].title,
        priority: audit.repairSuggestions[0].priority,
        detail: safeTrim(audit.repairSuggestions[0].detail, 140),
      }
    : undefined;
  const topIssue = audit.issues[0]
    ? {
        code: audit.issues[0].code,
        severity: audit.issues[0].severity,
        detail: safeTrim(audit.issues[0].detail, 140),
      }
    : undefined;
  const focus = {
    title: thread?.title || handoff?.task || status.activeFeature?.title || docSupport.mainlineTitle || basename(projectDir),
    status: thread?.status || status.activeFeature?.status,
    summary: thread?.summary || handoff?.summary || status.activeFeature?.detail || docSupport.mainlineSummary,
    nextStep: thread?.nextStep || handoff?.nextStep,
    featureId: thread?.featureId || handoff?.progressFeatureId || status.activeFeature?.id,
  };
  const stormDirective = buildStormDirective({
    stormPressure,
    stormMode,
    topRepair,
    topIssue,
    focus,
  });
  const stormAction = buildStormAction({
    stormDirective,
    topRepair,
    topIssue,
    focus,
  });
  const stormReadiness = buildStormReadiness({
    hasMainline: Boolean(thread || handoff || status.activeFeature || docSupport.mainlineTitle),
    anchors,
    evidence,
    recovery,
    graphEdges,
  });
  const supportingBasins = buildSupportingBasins({
    flow: {
      basin: flow.basin,
      current: flow.current,
      confidence: Number(flow.confidence.toFixed(2)),
    },
    anchors,
    recovery,
    evidence,
    issues: audit.issues,
    repairSuggestions: audit.repairSuggestions,
  });
  const stormBoundary = buildStormBoundary({
    stormPressure,
    stormReadiness,
    stormMode,
    topRepair,
    topIssue,
    supportingBasins,
  });
  const stormHorizon = buildStormHorizon({
    stormPressure,
    stormReadiness,
    stormBoundary,
    stormMode,
    topRepair,
    topIssue,
  });
  const stormConfidence = buildStormConfidence({
    stormPressure,
    stormReadiness,
    stormBoundary,
    stormHorizon,
    stormMode,
  });
  const stormGate = buildStormGate({
    stormPressure,
    stormReadiness,
    stormConfidence,
    stormBoundary,
    stormHorizon,
  });
  const stormBudget = buildStormBudget({
    stormGate,
    stormHorizon,
    stormReadiness,
    stormConfidence,
  });
  const stormSelection = buildStormSelection({
    stormBudget,
    stormBoundary,
    stormGate,
    stormHorizon,
  });
  const totalSignalCount = currents.length;
  const totalEvidenceCount = evidence.length;
  const totalRelationCount = graph.project.length + graph.thread.length + graph.handoff.length + graph.anchor.length + graph.recovery.length;
  const selectedCurrents = currents.slice(0, Math.max(1, stormSelection?.signalLimit ?? requestedSignalLimit));
  const selectedEvidence = evidence.slice(0, Math.max(1, stormSelection?.evidenceLimit ?? evidence.length));
  const appliedRelationLimit = Math.max(1, stormSelection?.relationLimit ?? requestedRelationLimit);
  const selectedGraph = {
    project: graph.project.slice(0, appliedRelationLimit) as unknown as Record<string, unknown>[],
    thread: graph.thread.slice(0, appliedRelationLimit) as unknown as Record<string, unknown>[],
    handoff: graph.handoff.slice(0, appliedRelationLimit) as unknown as Record<string, unknown>[],
    anchor: graph.anchor.slice(0, appliedRelationLimit) as unknown as Record<string, unknown>[],
    recovery: graph.recovery.slice(0, appliedRelationLimit) as unknown as Record<string, unknown>[],
  };
  const selectedCurrentMix = buildCurrentMix(selectedCurrents);
  const selectedRelationCount = selectedGraph.project.length + selectedGraph.thread.length + selectedGraph.handoff.length + selectedGraph.anchor.length + selectedGraph.recovery.length;
  const stormCoverage = buildStormCoverage({
    stormSelection,
    selectedSignals: selectedCurrents.length,
    totalSignals: totalSignalCount,
    selectedEvidence: selectedEvidence.length,
    totalEvidence: totalEvidenceCount,
    selectedRelations: selectedRelationCount,
    totalRelations: totalRelationCount,
  });
  const stormSaturation = buildStormSaturation({
    stormSelection,
    selectedSignals: selectedCurrents.length,
    totalSignals: totalSignalCount,
    selectedEvidence: selectedEvidence.length,
    totalEvidence: totalEvidenceCount,
    selectedRelations: selectedRelationCount,
    totalRelations: totalRelationCount,
  });
  const stormIntake = buildStormIntake({
    stormSelection,
    stormCoverage,
    stormSaturation,
    stormBudget,
    stormGate,
  });

  return {
    projectDir,
    projectNode: buildProjectNode(projectDir),
    query,
    focusQuery,
    refreshedGraph: refreshGraph,
    syncSummary,
    focus,
    flow: {
      basin: flow.basin,
      current: flow.current,
      confidence: Number(flow.confidence.toFixed(2)),
    },
    supportingBasins,
    thread,
    handoff,
    recovery,
    anchors,
    evidence: selectedEvidence,
    graph: selectedGraph,
    issues: audit.issues,
    repairSuggestions: audit.repairSuggestions,
    currents: selectedCurrents,
    currentMix: selectedCurrentMix,
    stormMode,
    stormPressure,
    stormDirective,
    stormAction,
    stormReadiness,
    stormBoundary,
    stormHorizon,
    stormConfidence,
    stormGate,
    stormBudget,
    stormSelection,
    stormCoverage,
    stormSaturation,
    stormIntake,
    topRepair,
    topIssue,
    metrics: {
      issueCount: audit.issueCount,
      repairCount: audit.repairSuggestions.length,
      evidenceCount: evidence.length,
      anchorCount: anchors.length,
      graphEdges,
      recoveryDepth: Number(recovery?.lineageDepth ?? 0),
    },
  };
}

export function buildTsunamiStormCenter(opts: BuildStormCenterOpts = {}): TsunamiStormCenter {
  return withTsunamiStormRetry(() => buildTsunamiStormCenterOnce(opts));
}

export function formatTsunamiStormCenterText(center: TsunamiStormCenter): string {
  const lines = [
    'TSUNAMI Storm Center',
    `Project: ${center.projectDir}`,
    `Focus: ${center.focus.title}${center.focus.status ? ` [${center.focus.status}]` : ''}`,
    `Focus Query: ${center.focusQuery}`,
  ];
  if (center.focus.nextStep) lines.push(`Next Step: ${center.focus.nextStep}`);
  if (center.focus.summary) lines.push(`Summary: ${safeTrim(center.focus.summary, 180)}`);
  lines.push(`Flow: ${center.flow.basin}/${center.flow.current} (confidence=${center.flow.confidence.toFixed(2)})`);
  if (center.stormAction) {
    lines.push(`Storm Action: ${center.stormAction.label}${center.stormAction.target ? ` -> ${center.stormAction.target}` : ''} · ${safeTrim(center.stormAction.reason, 88)}`);
  }
  if (center.stormReadiness) {
    lines.push(`Storm Readiness: ${center.stormReadiness.level} (${center.stormReadiness.score.toFixed(2)})${center.stormReadiness.gaps.length ? ` · gaps=${center.stormReadiness.gaps.join('|')}` : ''}`);
  }
  if (center.stormConfidence) {
    lines.push(`Storm Confidence: ${center.stormConfidence.level} (${center.stormConfidence.score.toFixed(2)}) · ${safeTrim(center.stormConfidence.reason, 88)}`);
  }
  if (center.stormGate) {
    lines.push(`Storm Gate: ${center.stormGate.verdict}${center.stormGate.allowForward ? ' · forward-ok' : ' · hold'} · ${safeTrim(center.stormGate.reason, 88)}`);
  }
  if (center.stormBudget) {
    lines.push(`Storm Budget: ${center.stormBudget.mode} (${center.stormBudget.steps} step${center.stormBudget.steps !== 1 ? 's' : ''}) · ${safeTrim(center.stormBudget.reason, 88)}`);
  }
  if (center.stormSelection) {
    lines.push(`Storm Selection: ${center.stormSelection.profile} · signals=${center.stormSelection.signalLimit} evidence=${center.stormSelection.evidenceLimit} relations=${center.stormSelection.relationLimit} · ${safeTrim(center.stormSelection.reason, 88)}`);
  }
  if (center.stormCoverage) {
    lines.push(`Storm Coverage: ${center.stormCoverage.mode} (${center.stormCoverage.score.toFixed(2)}) · signals=${center.stormCoverage.selectedSignals}/${center.stormCoverage.totalSignals} evidence=${center.stormCoverage.selectedEvidence}/${center.stormCoverage.totalEvidence} relations=${center.stormCoverage.selectedRelations}/${center.stormCoverage.totalRelations} · ${safeTrim(center.stormCoverage.reason, 88)}`);
  }
  if (center.stormSaturation) {
    lines.push(`Storm Saturation: ${center.stormSaturation.level} · ${center.stormSaturation.hitLanes.length ? center.stormSaturation.hitLanes.join('/') : 'clear'} · ${safeTrim(center.stormSaturation.reason, 88)}`);
  }
  if (center.stormIntake) {
    lines.push(`Storm Intake: ${center.stormIntake.mode} -> ${center.stormIntake.target} · next=${center.stormIntake.nextSignalLimit}/${center.stormIntake.nextEvidenceLimit}/${center.stormIntake.nextRelationLimit} · ${safeTrim(center.stormIntake.reason, 88)}`);
  }
  if (center.stormBoundary) {
    lines.push(`Storm Boundary: ${center.stormBoundary.mode}${center.stormBoundary.expand ? ' · expand-support' : ' · keep-tight'} · ${safeTrim(center.stormBoundary.reason, 88)}`);
  }
  if (center.stormHorizon) {
    lines.push(`Storm Horizon: ${center.stormHorizon.label} (${center.stormHorizon.steps} step${center.stormHorizon.steps > 1 ? 's' : ''}) · ${safeTrim(center.stormHorizon.reason, 88)}`);
  }
  if (center.supportingBasins.length > 0) {
    lines.push(`Sea Mix: ${center.supportingBasins.map((item) => `${item.basin}(${item.energy.toFixed(2)})`).join(' · ')}`);
    lines.push(`Sea Drivers: ${center.supportingBasins.slice(0, 2).map((item) => `${item.basin}<=${item.drivers.slice(0, 2).join(', ')}`).join(' | ')}`);
  }
  if (center.currentMix.length > 0) {
    lines.push(`Current Mix: ${center.currentMix.map((item) => `${item.kind}(${item.energy.toFixed(2)}/${item.count})`).join(' · ')}`);
  }
  if (center.stormMode) {
    lines.push(`Storm Mode: ${center.stormMode.label} (dominant=${center.stormMode.dominantKind} @ ${center.stormMode.dominance.toFixed(2)})`);
  }
  if (center.stormPressure) {
    lines.push(`Storm Pressure: ${center.stormPressure.level} (${center.stormPressure.score.toFixed(2)})${center.stormPressure.reasons.length ? ` · ${center.stormPressure.reasons.join(' | ')}` : ''}`);
  }
  if (center.stormDirective) {
    lines.push(`Storm Directive: ${center.stormDirective.label} (${center.stormDirective.lane}) · ${safeTrim(center.stormDirective.reason, 88)}`);
  }
  lines.push(
    `Metrics: anchors=${center.metrics.anchorCount} | evidence=${center.metrics.evidenceCount} | issues=${center.metrics.issueCount} | repairs=${center.metrics.repairCount} | graph_edges=${center.metrics.graphEdges} | recovery_depth=${center.metrics.recoveryDepth}`,
  );
  if (center.currents.length > 0) {
    lines.push('', 'Currents:');
    for (const current of center.currents.slice(0, 8)) {
      lines.push(`- [${current.kind}] energy=${current.energy.toFixed(2)} ${current.label}`);
      if (current.detail) lines.push(`  ${current.detail}`);
    }
  }
  if (center.repairSuggestions.length > 0) {
    lines.push('', 'Repair Energy:');
    for (const suggestion of center.repairSuggestions.slice(0, 3)) {
      lines.push(`- [${suggestion.priority}] ${suggestion.title}: ${safeTrim(suggestion.detail, 160)}`);
    }
  }
  if (center.topIssue) {
    lines.push('', 'Top Issue:');
    lines.push(`- [${center.topIssue.severity ?? 'low'}] ${center.topIssue.code}: ${center.topIssue.detail ?? ''}`.trim());
  }
  if (center.evidence.length > 0) {
    lines.push('', 'Evidence:');
    for (const snippet of center.evidence.slice(0, 3)) {
      lines.push(`- ${safeTrim(snippet.quote, 160)}`);
    }
  }
  if (center.anchors.length > 0) {
    lines.push('', 'Anchors:');
    for (const anchor of center.anchors.slice(0, 2)) {
      lines.push(`- ${anchor.title} (confidence=${anchor.confidence.toFixed(2)})`);
    }
  }
  return lines.join('\n');
}
