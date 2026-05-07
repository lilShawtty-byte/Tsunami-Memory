/**
 * TSUNAMI memory provider types
 *
 * Defines the memory provider interface and associated option types
 * used by the memory fabric layer.
 */

export interface MemoryAddOptions {
  wing?: string;
  room?: string;
  importance?: number;
  source?: string;
  sessionId?: string;
  projectDir?: string;
  fingerprint?: string;
}

export interface MemorySearchOptions {
  query: string;
  wing?: string;
  room?: string;
  limit?: number;
}

export interface MemoryRecallOptions {
  wing?: string;
  room?: string;
  limit?: number;
}

export interface MemoryWakeOptions {
  wing?: string;
  limit?: number;
}

export interface MemorySyncOptions {
  projectDir?: string;
  refreshGraph?: boolean;
}

export interface MemoryCompactOptions {
  targetWing?: string;
  targetRoom?: string;
  maxEntries?: number;
}

export interface MemoryPrefetchOptions {
  query?: string;
  wing?: string;
  limit?: number;
}

export interface MemoryQueryIntent {
  query: string;
  primaryWing?: string;
  primaryRoom?: string;
}

export interface MemoryProvider {
  add(entry: MemoryAddOptions): string;
  search(opts: MemorySearchOptions): any[];
  recall(opts: MemoryRecallOptions): any[];
  wake(opts: MemoryWakeOptions): any[];
  status(): Record<string, unknown>;
  listWings(): Record<string, number>;
  listRooms(wing?: string): Record<string, number>;
  timeline(limit?: number): any[];
}
