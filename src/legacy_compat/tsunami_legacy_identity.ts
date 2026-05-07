/**
 * TSUNAMI legacy identity stub
 *
 * Provides legacy identity text replacements and detection.
 * All replacements are empty by default; the Bun-native runtime
 * handles identity normalization directly.
 */

export const TSUNAMI_LEGACY_IDENTITY_REPLACEMENTS: Array<[RegExp, string]> = [];

export function hasTsunamiLegacyIdentityTerms(_raw: string): boolean {
  return false;
}
