// Storm center — type definitions
import type { ProjectHandoffRecord, ProjectTaskThread } from '../core/project_state';
import type { DurableRecoveryRecord } from '../runtime/checkpoints/durable_recovery';
import type { TsunamiRuntimeGraphSyncSummary } from '../tsunami_runtime_graph_sync';

export type BuildStormCenterOpts = {
  projectDir?: string;
  query?: string;
  sessionId?: string;
  refreshGraph?: boolean;
  evidenceLimit?: number;
  signalLimit?: number;
  relationLimit?: number;
};

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
