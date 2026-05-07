import { existsSync, readFileSync } from 'fs';

import {
  TSUNAMI_LEGACY_IDENTITY_REPLACEMENTS,
  hasTsunamiLegacyIdentityTerms,
} from './legacy_compat/tsunami_legacy_identity';
import { TSUNAMI_IDENTITY_FILE } from './tsunami_storage_paths';

const NO_IDENTITY = 'No identity configured.';

export function normalizeTsunamiIdentityText(raw: string): string {
  let next = String(raw ?? '').trim();
  if (!next) return NO_IDENTITY;
  for (const [pattern, replacement] of TSUNAMI_LEGACY_IDENTITY_REPLACEMENTS) {
    next = next.replace(pattern, replacement);
  }
  if (!/TSUNAMI/.test(next)) {
    next = `${next}\n\nPrimary memory system: TSUNAMI (Bun-native ocean memory runtime)`;
  }
  return next;
}

export function readTsunamiIdentity(path = TSUNAMI_IDENTITY_FILE): string {
  try {
    if (!existsSync(path)) return NO_IDENTITY;
    return normalizeTsunamiIdentityText(readFileSync(path, 'utf8'));
  } catch {
    return NO_IDENTITY;
  }
}

export function hasLegacyIdentityTerms(raw: string): boolean {
  return hasTsunamiLegacyIdentityTerms(raw);
}
