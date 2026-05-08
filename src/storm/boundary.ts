import type { TsunamiStormPressure, TsunamiStormReadiness, TsunamiStormCenterStormMode, TsunamiStormBoundary } from './types';
import type { TsunamiStormCenter } from './types';

export function buildStormBoundary(input: {
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
