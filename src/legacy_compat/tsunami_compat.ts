/**
 * TSUNAMI legacy compatibility stubs
 *
 * Provides compatibility wrappers for the legacy Python-based TSUNAMI wrapper.
 * The Bun-native runtime uses these as fallback/opt-in paths only.
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
