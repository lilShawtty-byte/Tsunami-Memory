import type { TsunamiStormPressure, TsunamiStormCenterStormMode, TsunamiStormDirective, TsunamiStormAction } from './types';
import type { TsunamiStormCenter } from './types';

export function buildStormDirective(input: {
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
export function buildStormAction(input: {
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
