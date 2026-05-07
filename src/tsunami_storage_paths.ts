import { statePath } from './runtime/paths';

export const TSUNAMI_RUNTIME_MEMORY_DIR = statePath('memory');
export const TSUNAMI_GRAPH_DB_PATH = statePath('memory', 'tsunami_graph.sqlite3');
export const BUN_MEMORY_DB_PATH = statePath('memory', 'tsunami_memory.sqlite3');
export const TSUNAMI_IDENTITY_FILE = statePath('memory', 'tsunami_identity.txt');
export const TSUNAMI_LEGACY_FALLBACK_FILE = statePath('memory', 'legacy_fallback_drawers.json');
export const TSUNAMI_MIGRATION_DIR = statePath('memory', 'migration');
