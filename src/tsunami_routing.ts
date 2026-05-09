import { TSUNAMI_COMPAT_WRAPPER } from './legacy_compat/tsunami_compat';

export type TsunamiMemoryRoutingPolicy = 'bun_native' | 'wrapper_bridge' | 'unknown';

export type TsunamiWrapperShellSummary = {
  shell: 'python_wrapper';
  path: string;
  routeMode: 'opt_in_only';
  implementedCount: number;
  implementedCommands: string[];
  defaultRoutedCommands: string[];
  wrapperBridgeCount: number;
  unknownRouteDefault: 'blocked';
  notes: string[];
};

export const TSUNAMI_BUN_NATIVE_CMDS = [
  'status',
  'wakeup',
  'search',
  'recall',
  'add',
  'diary',
  'mine',
  'timeline',
  'list_wings',
  'list_rooms',
  'get_taxonomy',
  'check_duplicate',
  'delete_drawer',
  'diary_read',
  'get_aaak_spec',
  'classify',
  'classify_multi',
  'tsunami_taxonomy',
  'tsunami_ontology',
  'normalize_taxonomy',
  'storm_center',
  'kg_add',
  'kg_query',
  'kg_invalidate',
  'kg_stats',
  'kg_timeline',
  'traverse_graph',
  'find_tunnels',
  'graph_stats',
  'add_embedding',
  'search_vector',
  'search_hybrid',
] as const;

export const TSUNAMI_WRAPPER_BRIDGE_CMDS = [] as const;

export const TSUNAMI_WRAPPER_IMPLEMENTED_CMDS = [
  'wakeup',
  'search',
  'recall',
  'status',
  'add',
  'kg_query',
  'kg_add',
  'kg_invalidate',
  'kg_stats',
  'diary',
  'list_wings',
  'list_rooms',
  'get_taxonomy',
  'check_duplicate',
  'delete_drawer',
  'traverse_graph',
  'find_tunnels',
  'graph_stats',
  'diary_read',
  'get_aaak_spec',
  'classify',
  'mine',
] as const;

const BUN_NATIVE_SET = new Set<string>(TSUNAMI_BUN_NATIVE_CMDS);
const WRAPPER_BRIDGE_SET = new Set<string>(TSUNAMI_WRAPPER_BRIDGE_CMDS);
const WRAPPER_IMPLEMENTED_SET = new Set<string>(TSUNAMI_WRAPPER_IMPLEMENTED_CMDS);

export type TsunamiBunCoverageSummary = {
  primary: 'bun_native';
  wrapperSurfaceCount: number;
  bunNativeCount: number;
  wrapperBridgeCount: number;
  wrapperOnlyCount: number;
  wrapperCoveredCount: number;
  coverageRatio: number;
  wrapperOnly: string[];
  hybridBridge: string[];
  bunNativeOnly: string[];
  bunNative: string[];
  wrapperImplemented: string[];
  wrapperBridge: string[];
  notes: string[];
};

export function resolveTsunamiRoutingPolicy(req: Record<string, unknown>): TsunamiMemoryRoutingPolicy {
  const cmd = String(req.cmd ?? '').trim();
  if (!cmd) return 'unknown';
  if (BUN_NATIVE_SET.has(cmd)) return 'bun_native';
  if (WRAPPER_BRIDGE_SET.has(cmd)) return 'wrapper_bridge';
  return 'unknown';
}

export function describeTsunamiRoutingMatrix() {
  return {
    primary: 'bun_native',
    bunNative: [...TSUNAMI_BUN_NATIVE_CMDS],
    wrapperImplemented: [...TSUNAMI_WRAPPER_IMPLEMENTED_CMDS],
    wrapperBridge: [...TSUNAMI_WRAPPER_BRIDGE_CMDS],
    wrapperShell: buildTsunamiWrapperShellSummary(),
    coverage: buildTsunamiBunCoverageSummary(),
    notes: [
      'delete_drawer now resolves through the Bun-native delete path for both bunmem and legacy fallback ids',
      'known Bun-native commands should not silently fall through to wrapper',
      'unknown commands are blocked by default; wrapper shell is opt-in only',
    ],
  };
}

export function buildTsunamiWrapperShellSummary(): TsunamiWrapperShellSummary {
  return {
    shell: 'python_wrapper',
    path: TSUNAMI_COMPAT_WRAPPER,
    routeMode: 'opt_in_only',
    implementedCount: TSUNAMI_WRAPPER_IMPLEMENTED_CMDS.length,
    implementedCommands: [...TSUNAMI_WRAPPER_IMPLEMENTED_CMDS],
    defaultRoutedCommands: [],
    wrapperBridgeCount: TSUNAMI_WRAPPER_BRIDGE_CMDS.length,
    unknownRouteDefault: 'blocked',
    notes: [
      'the wrapper shell remains on disk as a compatibility shell, not as a default route',
      'legacy wrapper execution now requires explicit opt-in',
      'default TSUNAMI routing should stay Bun-native or return unsupported',
    ],
  };
}

export function buildTsunamiBunCoverageSummary(): TsunamiBunCoverageSummary {
  const wrapperImplemented = [...TSUNAMI_WRAPPER_IMPLEMENTED_CMDS];
  const bunNative = [...TSUNAMI_BUN_NATIVE_CMDS];
  const wrapperBridge = [...TSUNAMI_WRAPPER_BRIDGE_CMDS];
  const wrapperOnly = wrapperImplemented.filter((cmd) => !BUN_NATIVE_SET.has(cmd) && !WRAPPER_BRIDGE_SET.has(cmd));
  const hybridBridge = wrapperImplemented.filter((cmd) => BUN_NATIVE_SET.has(cmd) && WRAPPER_BRIDGE_SET.has(cmd));
  const bunNativeOnly = bunNative.filter((cmd) => !WRAPPER_IMPLEMENTED_SET.has(cmd));
  const wrapperCoveredCount = wrapperImplemented.length - wrapperOnly.length;
  return {
    primary: 'bun_native',
    wrapperSurfaceCount: wrapperImplemented.length,
    bunNativeCount: bunNative.length,
    wrapperBridgeCount: wrapperBridge.length,
    wrapperOnlyCount: wrapperOnly.length,
    wrapperCoveredCount,
    coverageRatio: wrapperImplemented.length > 0
      ? Number((wrapperCoveredCount / wrapperImplemented.length).toFixed(3))
      : 1,
    wrapperOnly,
    hybridBridge,
    bunNativeOnly,
    bunNative,
    wrapperImplemented,
    wrapperBridge,
    notes: [
      'wrapper surface means commands historically implemented in the TSUNAMI legacy compatibility wrapper',
      'hybridBridge means the command is Bun-native by default but still keeps a narrow wrapper bridge',
      'wrapperOnly should trend toward zero as TSUNAMI finishes migration',
    ],
  };
}
