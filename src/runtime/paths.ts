/**
 * TSUNAMI state path utility
 *
 * Resolves paths under the TSUNAMI_HOME directory for state storage.
 */

const TSUNAMI_HOME = process.env.TSUNAMI_HOME || '.tsunami';

export function statePath(...parts: string[]): string {
  return [TSUNAMI_HOME, ...parts].join('/');
}
