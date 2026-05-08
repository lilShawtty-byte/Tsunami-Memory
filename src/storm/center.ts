// Storm center — orchestrator
import { existsSync, readFileSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import {
  getProjectLatestHandoff, getProjectStateStatus, listProjectWikiPages,
  queryProjectWiki, resolveProjectTaskThread,
  type ProjectHandoffRecord, type ProjectTaskThread,
} from '../core/project_state';
import { durableRecoveryStore, type DurableRecoveryRecord } from '../runtime/checkpoints/durable_recovery';
import { auditMemoryFabric } from '../memory_audit';
import { classifyTsunamiText } from '../tsunami_classifier';
import { tsunamiGraphQueryEntity } from '../tsunami_graph_runtime';
import { syncProjectRuntimeGraph, type TsunamiRuntimeGraphSyncSummary } from '../tsunami_runtime_graph_sync';
import {
  buildProjectNode, buildTaskThreadNode, buildHandoffNode,
  buildAnchorNode, buildRecoveryNode, clampEnergy, safeTrim,
  pickFocusQuery, buildFallbackDocStormSupport, readAnchorCandidates,
  withTsunamiStormRetry,
} from './helpers';
import { buildCurrents, buildCurrentMix } from './signals';
import { buildSupportingBasins } from './basins';
import { buildStormMode } from './mode';
import { buildStormPressure } from './pressure';
import { buildStormDirective, buildStormAction } from './directive';
import { buildStormReadiness } from './readiness';
import { buildStormBoundary } from './boundary';
import { buildStormHorizon } from './horizon';
import { buildStormConfidence } from './confidence';
import { buildStormGate } from './gate';
import { buildStormBudget } from './budget';
import { buildStormSelection } from './selection';
import { buildStormCoverage } from './coverage';
import { buildStormSaturation } from './saturation';
import { buildStormIntake } from './intake';
import type { TsunamiStormCenter, TsunamiStormCenterCurrent, BuildStormCenterOpts } from './types';

export { isTsunamiStormRetryableError, withTsunamiStormRetry } from './helpers';

export function buildTsunamiStormCenterOnce(opts: BuildStormCenterOpts = {}): TsunamiStormCenter {
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
