/**
 * TSUNAMI legacy compatibility stubs
 *
 * @deprecated These stubs exist to preserve compile-time compatibility with code
 * extracted from a larger Python-based monorepo. They provide fallback/opt-in paths
 * that are disabled by default. Scheduled for removal in v2.0.
 */

export const TSUNAMI_COMPAT_WRAPPER = '';
export const TSUNAMI_DEFAULT_LEGACY_ROOM = 'ats/general';

export function normalizeTsunamiCompatRoom(room: string): string {
  return String(room || TSUNAMI_DEFAULT_LEGACY_ROOM).trim().toLowerCase().replace(/\s+/g, '_');
}

export function isTsunamiLegacyWrapperExplicitlyEnabled(_req: Record<string, unknown>): boolean {
  return false;
}

export function listTsunamiCompatPythonCandidates(): string[] {
  return ['python3', 'python'];
}
