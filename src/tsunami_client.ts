/**
 * TSUNAMI Client — Bun-native operations
 */

import { spawn } from 'bun';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname } from 'path';
import {
  insertBunMemoryEntry,
} from './bun_memory_store';
import { tryHandleTsunamiBunRequest } from './tsunami_bun_backend';
import {
  describeTsunamiRoutingMatrix,
  resolveTsunamiRoutingPolicy,
} from './tsunami_routing';
import {
  readTsunamiIdentity,
} from './tsunami_identity';
import {
  TSUNAMI_IDENTITY_FILE,
  TSUNAMI_LEGACY_FALLBACK_FILE,
} from './tsunami_storage_paths';
import {
  TSUNAMI_COMPAT_WRAPPER,
  isTsunamiLegacyWrapperExplicitlyEnabled,
  listTsunamiCompatPythonCandidates,
} from './legacy_compat/tsunami_compat';

const PROJECT_ROOT = process.env.TSUNAMI_HOME || process.cwd();
const PRIMARY_TSUNAMI_PYTHON = process.env.TSUNAMI_PYTHON || '';
const TMP_DIR = process.env.TSUNAMI_TMP || '/tmp/tsunami';

type FallbackDrawer = {
  id: string;
  wing: string;
  room: string;
  content: string;
  importance: number;
  ts: number;
};

type FallbackStore = {
  version: number;
  updatedAt: number;
  drawers: FallbackDrawer[];
};

type TsunamiCacheEntry = {
  value: any;
  ts: number;
};

let warnedPrimaryDown = false;
let warnedFallbackOn = false;
let warnedPrimaryStderr = false;
let lastBackend: 'primary' | 'fallback' | 'bun_native' = 'bun_native';
const tsunamiReadCache = new Map<string, TsunamiCacheEntry>();
const tsunamiInflight = new Map<string, Promise<any>>();
const MAX_TSUNAMI_CACHE_ENTRIES = 64;
const READ_ONLY_CMDS = new Set([
  'wakeup',
  'search',
  'recall',
  'status',
  'timeline',
  'kg_timeline',
  'kg_query',
  'kg_stats',
  'list_wings',
  'list_rooms',
  'get_taxonomy',
  'check_duplicate',
  'traverse_graph',
  'find_tunnels',
  'graph_stats',
  'diary_read',
  'get_aaak_spec',
  'classify',
]);
const WRITE_CMDS = new Set([
  'add',
  'diary',
  'kg_add',
  'kg_invalidate',
  'delete_drawer',
  'mine',
]);

function getReadCacheTtl(cmd: string): number {
  switch (cmd) {
    case 'wakeup':
      return 30_000;
    case 'search':
      return 18_000;
    case 'recall':
      return 12_000;
    case 'status':
    case 'kg_stats':
      return 6_000;
    case 'timeline':
    case 'kg_timeline':
      return 8_000;
    default:
      return 15_000;
  }
}

function buildCacheKey(req: Record<string, unknown>): string {
  return JSON.stringify(req);
}

function getCachedRead(req: Record<string, unknown>): any | null {
  const cmd = String(req.cmd ?? '').trim();
  if (!READ_ONLY_CMDS.has(cmd)) return null;
  const key = buildCacheKey(req);
  const hit = tsunamiReadCache.get(key);
  if (!hit) return null;
  if (Date.now() - hit.ts > getReadCacheTtl(cmd)) {
    tsunamiReadCache.delete(key);
    return null;
  }
  return hit.value;
}

function setCachedRead(req: Record<string, unknown>, value: any) {
  const cmd = String(req.cmd ?? '').trim();
  if (!READ_ONLY_CMDS.has(cmd)) return;
  if (tsunamiReadCache.size >= MAX_TSUNAMI_CACHE_ENTRIES) {
    const firstKey = tsunamiReadCache.keys().next().value;
    if (firstKey) tsunamiReadCache.delete(firstKey);
  }
  tsunamiReadCache.set(buildCacheKey(req), {
    value,
    ts: Date.now(),
  });
}

function clearReadCaches() {
  tsunamiReadCache.clear();
}

function tokenize(text: string): string[] {
  return (text.toLowerCase().match(/[\u4e00-\u9fa5a-z0-9_]+/g) ?? []).filter(Boolean);
}

function loadFallbackStore(): FallbackStore {
  try {
    if (!existsSync(TSUNAMI_LEGACY_FALLBACK_FILE)) {
      return { version: 1, updatedAt: Date.now(), drawers: [] };
    }
    const raw = JSON.parse(readFileSync(TSUNAMI_LEGACY_FALLBACK_FILE, 'utf8'));
    const drawers = Array.isArray(raw?.drawers) ? raw.drawers : [];
    return {
      version: 1,
      updatedAt: Number(raw?.updatedAt ?? Date.now()),
      drawers: drawers
        .filter((d: any) => d && typeof d.content === 'string')
        .map((d: any) => ({
          id: String(d.id ?? ''),
          wing: String(d.wing ?? 'ats'),
          room: String(d.room ?? 'ats/general'),
          content: String(d.content ?? ''),
          importance: Number(d.importance ?? 3),
          ts: Number(d.ts ?? Date.now()),
        })),
    };
  } catch {
    console.warn('[TSUNAMI fallback] failed to parse legacy fallback archive; resetting store');
    return { version: 1, updatedAt: Date.now(), drawers: [] };
  }
}

function saveFallbackStore(store: FallbackStore) {
  const dir = dirname(TSUNAMI_LEGACY_FALLBACK_FILE);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  store.updatedAt = Date.now();
  writeFileSync(TSUNAMI_LEGACY_FALLBACK_FILE, JSON.stringify(store, null, 2), 'utf8');
}

function scoreMemory(query: string, drawer: FallbackDrawer): number {
  const qTokens = tokenize(query);
  if (!qTokens.length) return 0;
  const text = `${drawer.content} ${drawer.wing} ${drawer.room}`.toLowerCase();
  let hit = 0;
  for (const t of qTokens) if (text.includes(t)) hit++;
  const hitScore = hit / qTokens.length;
  const importanceBoost = Math.min(drawer.importance, 5) * 0.08;
  const recencyBoost = Math.max(0, 1 - (Date.now() - drawer.ts) / (1000 * 60 * 60 * 24 * 30)) * 0.05;
  return hitScore + importanceBoost + recencyBoost;
}

function topDrawers(
  store: FallbackStore,
  opts: { wing?: string; room?: string; query?: string; limit?: number } = {},
): Array<{ d: FallbackDrawer; score: number }> {
  const wing = opts.wing?.trim();
  const room = opts.room?.trim();
  const limit = Math.max(1, Number(opts.limit ?? 5));
  const candidates = store.drawers.filter((d) => {
    if (wing && d.wing !== wing) return false;
    if (room && d.room !== room) return false;
    return true;
  });
  const scored = candidates.map((d) => ({
    d,
    score: opts.query ? scoreMemory(opts.query, d) : (d.importance * 0.1 + d.ts / 1e15),
  }));
  scored.sort((a, b) => b.score - a.score || b.d.ts - a.d.ts);
  return scored.slice(0, limit);
}

function fallbackWakeup(wing?: string): string {
  const store = loadFallbackStore();
  const identity = readTsunamiIdentity(TSUNAMI_IDENTITY_FILE);
  const target = wing?.trim();
  const selected = target ? store.drawers.filter((d) => d.wing === target) : store.drawers;
  const wingCounts: Record<string, number> = {};
  for (const d of selected) wingCounts[d.wing] = (wingCounts[d.wing] ?? 0) + 1;
  const topWings = Object.entries(wingCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([w, c]) => `${w}:${c}`)
    .join(' / ') || 'none';
  const highlights = topDrawers(
    { ...store, drawers: selected },
    { limit: 5 },
  ).map(({ d }, i) => `  [${i + 1}] ${d.wing}/${d.room} ${d.content.slice(0, 120)}`);

  return [
    '## L0 — IDENTITY',
    identity,
    '',
    '## L1 — ESSENTIAL STORY',
    `backend=fallback-json`,
    `total=${selected.length} (global=${store.drawers.length})`,
    `top_wings=${topWings}`,
    ...(highlights.length ? ['', ...highlights] : ['', '  (no memories yet)']),
  ].join('\n');
}

function fallbackSearch(query: string, wing?: string, room?: string, limit = 5): string {
  const store = loadFallbackStore();
  const rows = topDrawers(store, { query, wing, room, limit });
  if (!rows.length) {
    return `## L3 — SEARCH RESULTS for "${query}"\n  (no results)`;
  }
  const lines = [`## L3 — SEARCH RESULTS for "${query}"`];
  rows.forEach(({ d, score }, i) => {
    lines.push(`  [${i + 1}] ${d.wing}/${d.room} (sim=${score.toFixed(3)})`);
    lines.push(`      ${d.content.slice(0, 200)}`);
    if (d.content.length > 200) lines.push('      ...');
  });
  return lines.join('\n');
}

function fallbackRecall(wing?: string, room?: string, limit = 10): string {
  const store = loadFallbackStore();
  const rows = topDrawers(store, { wing, room, limit });
  if (!rows.length) {
    return '## L2 — RECALL\n  (no memories)';
  }
  const lines = ['## L2 — RECALL'];
  rows.forEach(({ d }, i) => {
    lines.push(`  [${i + 1}] ${d.wing}/${d.room}`);
    lines.push(`      ${d.content.slice(0, 220)}`);
    if (d.content.length > 220) lines.push('      ...');
  });
  return lines.join('\n');
}

function fallbackAdd(wing: string, room: string, content: string, importance = 3): string {
  const store = loadFallbackStore();
  const id = `fb_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  store.drawers.push({
    id,
    wing: wing || 'ats',
    room: room || 'ats/general',
    content: content || '',
    importance: Number(importance ?? 3),
    ts: Date.now(),
  });
  if (store.drawers.length > 5000) {
    store.drawers = store.drawers.slice(-5000);
  }
  saveFallbackStore(store);
  return id;
}

function fallbackListWings(): Record<string, number> {
  const store = loadFallbackStore();
  const wings: Record<string, number> = {};
  for (const d of store.drawers) wings[d.wing] = (wings[d.wing] ?? 0) + 1;
  return wings;
}

function fallbackListRooms(wing?: string): Record<string, number> {
  const store = loadFallbackStore();
  const rooms: Record<string, number> = {};
  for (const d of store.drawers) {
    if (wing && d.wing !== wing) continue;
    rooms[d.room] = (rooms[d.room] ?? 0) + 1;
  }
  return rooms;
}

function fallbackStatus() {
  const store = loadFallbackStore();
  return {
    backend: 'fallback-json',
    total_drawers: store.drawers.length,
    wings: fallbackListWings(),
    updated_at: new Date(store.updatedAt).toISOString(),
    path: TSUNAMI_LEGACY_FALLBACK_FILE,
  };
}

function fallbackCheckDuplicate(content: string, threshold = 0.9) {
  const store = loadFallbackStore();
  const cTok = new Set(tokenize(content));
  const matches: Array<{ id: string; wing: string; room: string; similarity: number; content: string }> = [];
  for (const d of store.drawers) {
    const dTok = new Set(tokenize(d.content));
    const inter = [...cTok].filter((t) => dTok.has(t)).length;
    const union = new Set([...cTok, ...dTok]).size || 1;
    const sim = inter / union;
    if (sim >= threshold) {
      matches.push({
        id: d.id,
        wing: d.wing,
        room: d.room,
        similarity: Number(sim.toFixed(3)),
        content: d.content.slice(0, 200),
      });
    }
  }
  matches.sort((a, b) => b.similarity - a.similarity);
  return { is_duplicate: matches.length > 0, matches: matches.slice(0, 5) };
}

function fallbackRaw(req: Record<string, unknown>, cause: Error): any {
  if (!warnedFallbackOn) {
    console.warn(`[TSUNAMI] fallback backend enabled: ${cause.message}`);
    warnedFallbackOn = true;
  }
  const cmd = String(req.cmd ?? '');
  if (cmd === 'wakeup') return { ok: true, data: fallbackWakeup(String(req.wing ?? '') || undefined) };
  if (cmd === 'search') return { ok: true, data: fallbackSearch(String(req.query ?? ''), String(req.wing ?? '') || undefined, String(req.room ?? '') || undefined, Number(req.limit ?? 5)) };
  if (cmd === 'recall') return { ok: true, data: fallbackRecall(String(req.wing ?? '') || undefined, String(req.room ?? '') || undefined, Number(req.limit ?? 10)) };
  if (cmd === 'add') return { ok: true, id: fallbackAdd(String(req.wing ?? 'ats'), String(req.room ?? 'ats/general'), String(req.content ?? ''), Number(req.importance ?? 3)) };
  if (cmd === 'diary') {
    const room = `diary-${String(req.agent ?? 'ats')}`;
    return { ok: true, id: fallbackAdd(String(req.wing ?? 'ats'), room, String(req.entry ?? ''), Number(req.importance ?? 3)) };
  }
  if (cmd === 'status') return { ok: true, data: fallbackStatus() };
  if (cmd === 'list_wings') return { ok: true, wings: fallbackListWings() };
  if (cmd === 'list_rooms') return { ok: true, wing: req.wing ?? 'all', rooms: fallbackListRooms(String(req.wing ?? '') || undefined) };
  if (cmd === 'get_taxonomy') {
    const store = loadFallbackStore();
    const taxonomy: Record<string, Record<string, number>> = {};
    for (const d of store.drawers) {
      taxonomy[d.wing] = taxonomy[d.wing] ?? {};
      taxonomy[d.wing][d.room] = (taxonomy[d.wing][d.room] ?? 0) + 1;
    }
    return { ok: true, taxonomy };
  }
  if (cmd === 'check_duplicate') {
    const result = fallbackCheckDuplicate(String(req.content ?? ''), Number(req.threshold ?? 0.9));
    return { ok: true, ...result };
  }
  if (cmd === 'delete_drawer') {
    const drawerId = String(req.drawer_id ?? '');
    if (!drawerId) return { ok: false, error: 'drawer_id required (fallback)' };
    const store = loadFallbackStore();
    const before = store.drawers.length;
    store.drawers = store.drawers.filter((d) => d.id !== drawerId);
    if (store.drawers.length === before) return { ok: false, error: `Drawer not found: ${drawerId}` };
    saveFallbackStore(store);
    return { ok: true, deleted_id: drawerId };
  }
  return { ok: false, error: `TSUNAMI backend unavailable and fallback does not support cmd=${cmd}` };
}

function pickPythonExecutable(): string {
  const envPython = String(process.env.TSUNAMI_PYTHON ?? '').trim();
  if (envPython && existsSync(envPython)) return envPython;
  if (existsSync(PRIMARY_TSUNAMI_PYTHON)) return PRIMARY_TSUNAMI_PYTHON;
  for (const candidate of listTsunamiCompatPythonCandidates()) {
    if (existsSync(candidate)) return candidate;
  }
  return 'python3';
}

async function callPrimary(req: Record<string, unknown>, timeoutMs = 20000): Promise<any> {
  if (!existsSync(TMP_DIR)) mkdirSync(TMP_DIR, { recursive: true });
  const pythonBin = pickPythonExecutable();
  const proc = spawn({
    cmd: [pythonBin, '-u', TSUNAMI_COMPAT_WRAPPER],
    cwd: PROJECT_ROOT,
    env: {
      ...process.env,
      TMPDIR: TMP_DIR,
      TMP: TMP_DIR,
      TEMP: TMP_DIR,
    },
    stdout: 'pipe',
    stderr: 'pipe',
    stdin: 'pipe',
  });

  const input = JSON.stringify(req) + '\n';
  const stdin = proc.stdin as { write: (chunk: string) => void; end: () => void } | null;
  stdin?.write(input);
  stdin?.end();

  const timer = setTimeout(() => {
    try {
      proc.kill();
    } catch (error) {
      const fallbackMode = 'continue_with_primary_wrapper_timeout_cleanup';
      console.warn(`[TSUNAMI] failed to terminate primary wrapper after timeout; fallback ${fallbackMode}:`, error);
    }
  }, timeoutMs);

  try {
    const [stdout, stderr] = await Promise.all([
      new Response(proc.stdout).text(),
      new Response(proc.stderr).text(),
    ]);
    clearTimeout(timer);

    if (stderr.trim() && !warnedPrimaryStderr) {
      console.warn('[TSUNAMI stderr]', stderr.trim().slice(0, 300));
      warnedPrimaryStderr = true;
    }

    const lines = stdout.split('\n').filter(l => l.trim());
    if (!lines.length) throw new Error('empty stdout');
    const lastLine = lines[lines.length - 1];
    try {
      const parsed = JSON.parse(lastLine);
      if (parsed && typeof parsed === 'object' && !('__backend' in parsed)) {
        (parsed as Record<string, unknown>).__backend = 'primary';
      }
      lastBackend = 'primary';
      return parsed;
    } catch {
      throw new Error('invalid json from tsunami wrapper: ' + lastLine.slice(0, 200));
    }
  } catch (e: any) {
    clearTimeout(timer);
    try {
      proc.kill();
    } catch (error) {
      const fallbackMode = 'continue_with_primary_wrapper_error_cleanup';
      console.warn(`[TSUNAMI] failed to terminate primary wrapper after error; fallback ${fallbackMode}:`, error);
    }
    throw e;
  }
}

async function call(req: Record<string, unknown>, timeoutMs = 20000): Promise<any> {
  const cmd = String(req.cmd ?? '').trim();
  const key = buildCacheKey(req);
  const routingPolicy = resolveTsunamiRoutingPolicy(req);
  const legacyWrapperEnabled = isTsunamiLegacyWrapperExplicitlyEnabled(req);
  const cached = getCachedRead(req);
  if (cached !== null) {
    return cached;
  }
  const bunNative = tryHandleTsunamiBunRequest(req);
  if (bunNative !== null) {
    lastBackend = 'bun_native';
    if (WRITE_CMDS.has(cmd)) clearReadCaches();
    setCachedRead(req, bunNative);
    return bunNative;
  }
  if (routingPolicy === 'bun_native') {
    return {
      ok: false,
      error: `bun_native handler returned no result for cmd=${cmd}`,
      expected_route: 'bun_native',
      routing_summary: describeTsunamiRoutingMatrix(),
      __backend: 'bun_native',
    };
  }
  if (!legacyWrapperEnabled) {
    return {
      ok: false,
      error: `TSUNAMI Bun-native routing does not expose cmd=${cmd}; legacy wrapper shell is dormant`,
      expected_route: routingPolicy === 'unknown' ? 'unsupported' : routingPolicy,
      routing_summary: describeTsunamiRoutingMatrix(),
      compatibility_shell: 'python_wrapper_dormant',
      compatibility_route: 'opt_in_only',
      __backend: 'bun_native',
    };
  }
  if (READ_ONLY_CMDS.has(cmd)) {
    const inflight = tsunamiInflight.get(key);
    if (inflight) return inflight;
  }

  const task = (async () => {
    try {
      const value = await callPrimary(req, timeoutMs);
      if (cmd === 'add' && !req.skip_bun_hot_mirror) {
        insertBunMemoryEntry({
          wing: String(req.wing ?? 'ats'),
          room: String(req.room ?? 'ats/general'),
          content: String(req.content ?? ''),
          importance: Number(req.importance ?? 3),
          source: String(req.source ?? 'tsunami_direct').trim() || 'tsunami_direct',
          sessionId: String(req.session_id ?? '').trim() || undefined,
          projectDir: String(req.project_dir ?? '').trim() || undefined,
          fingerprint: String(req.fingerprint ?? '').trim() || undefined,
        });
      } else if (cmd === 'diary' && !req.skip_bun_hot_mirror) {
        insertBunMemoryEntry({
          wing: String(req.wing ?? 'ats'),
          room: `diary-${String(req.agent ?? 'ats')}`,
          content: String(req.entry ?? ''),
          importance: Number(req.importance ?? 3),
          source: 'tsunami_diary',
        });
      }
      setCachedRead(req, value);
      if (WRITE_CMDS.has(cmd)) clearReadCaches();
      return value;
    } catch (e: any) {
      if (!warnedPrimaryDown) {
        console.warn(`[TSUNAMI] primary backend failed, fallback mode: ${e?.message ?? e}`);
        warnedPrimaryDown = true;
      }
      const fb = fallbackRaw(req, e instanceof Error ? e : new Error(String(e)));
      if (fb && typeof fb === 'object' && !('__backend' in fb)) {
        fb.__backend = 'fallback';
      }
      lastBackend = 'fallback';
      setCachedRead(req, fb);
      if (WRITE_CMDS.has(cmd)) clearReadCaches();
      return fb;
    }
  })();

  if (READ_ONLY_CMDS.has(cmd)) {
    tsunamiInflight.set(key, task);
  }

  try {
    return await task;
  } finally {
    if (READ_ONLY_CMDS.has(cmd)) {
      tsunamiInflight.delete(key);
    }
  }
}

// ── Public API ────────────────────────────────────────

export async function tsunamiWakeUp(wing?: string): Promise<string> {
  const resp = await call({ cmd: 'wakeup', wing });
  if (!resp.ok) throw new Error(resp.error);
  return resp.data ?? '';
}

export async function tsunamiSearch(query: string, wing?: string, room?: string, limit = 5): Promise<string> {
  const resp = await call({ cmd: 'search', query, wing, room, limit });
  if (!resp.ok) throw new Error(resp.error);
  return resp.data ?? '';
}

export async function tsunamiRecall(wing?: string, room?: string, limit = 10): Promise<string> {
  const resp = await call({ cmd: 'recall', wing, room, limit });
  if (!resp.ok) throw new Error(resp.error);
  return resp.data ?? '';
}

export interface TsunamiAddOptions {
  skipBunHotMirror?: boolean;
  sessionId?: string;
  projectDir?: string;
  source?: string;
  fingerprint?: string;
  date?: string;
}

export async function tsunamiAdd(
  wing: string,
  room: string,
  content: string,
  importance = 3,
  options?: TsunamiAddOptions,
): Promise<string> {
  const resp = await call({
    cmd: 'add',
    wing,
    room,
    content,
    importance,
    skip_bun_hot_mirror: options?.skipBunHotMirror === true,
    session_id: options?.sessionId,
    project_dir: options?.projectDir,
    source: options?.source,
    fingerprint: options?.fingerprint,
    date: options?.date,
  });
  if (!resp.ok) throw new Error(resp.error);
  return resp.id ?? '';
}

export async function tsunamiDiary(entry: string, agent = 'ats', wing = 'ats', importance = 3, options?: { skipBunHotMirror?: boolean }): Promise<string> {
  const resp = await call({ cmd: 'diary', entry, agent, wing, importance, skip_bun_hot_mirror: options?.skipBunHotMirror === true });
  if (!resp.ok) throw new Error(resp.error);
  return resp.id ?? '';
}

export async function tsunamiKgQuery(entity: string): Promise<string> {
  const resp = await call({ cmd: 'kg_query', entity });
  if (!resp.ok) throw new Error(resp.error);
  if (typeof resp.data === 'string') return resp.data;
  return JSON.stringify(resp.data ?? [], null, 2);
}

export async function tsunamiKgAdd(subject: string, predicate: string, object: string, validFrom?: string): Promise<void> {
  const resp = await call({ cmd: 'kg_add', subject, predicate, object, valid_from: validFrom });
  if (!resp.ok) throw new Error(resp.error);
}

export async function tsunamiKgAddTyped(options: {
  subject: string;
  subjectType?: string;
  subjectProperties?: Record<string, unknown>;
  predicate: string;
  object: string;
  objectType?: string;
  objectProperties?: Record<string, unknown>;
  validFrom?: string;
  validTo?: string;
  confidence?: number;
  sourceFile?: string;
}): Promise<void> {
  const resp = await call({
    cmd: 'kg_add',
    subject: options.subject,
    subject_type: options.subjectType,
    subject_properties: options.subjectProperties,
    predicate: options.predicate,
    object: options.object,
    object_type: options.objectType,
    object_properties: options.objectProperties,
    valid_from: options.validFrom,
    valid_to: options.validTo,
    confidence: options.confidence,
    source_file: options.sourceFile,
  });
  if (!resp.ok) throw new Error(resp.error);
}

export async function tsunamiKgStats(): Promise<any> {
  const resp = await call({ cmd: 'kg_stats' });
  if (!resp.ok) throw new Error(resp.error);
  return resp.data;
}

export async function tsunamiKgTimeline(entity?: string, limit = 20): Promise<any> {
  const resp = await call({ cmd: 'kg_timeline', entity, limit });
  if (!resp.ok) throw new Error(resp.error);
  return resp.data;
}

export async function tsunamiTimeline(limit = 20): Promise<any> {
  const resp = await call({ cmd: 'timeline', limit });
  if (!resp.ok) throw new Error(resp.error);
  return resp.data;
}

export async function tsunamiStatus(): Promise<any> {
  const resp = await call({ cmd: 'status' });
  if (!resp.ok) throw new Error(resp.error);
  if (resp.data && typeof resp.data === 'object') {
    return {
      ...resp.data,
      runtime_backend: resp.runtime_backend ?? resp.__backend ?? lastBackend,
      routing_summary: resp.data.routing_summary ?? describeTsunamiRoutingMatrix(),
      python: pickPythonExecutable(),
      wrapper: TSUNAMI_COMPAT_WRAPPER,
      wrapper_route_mode: 'opt_in_only',
    };
  }
  return {
    value: resp.data,
    runtime_backend: resp.__backend ?? lastBackend,
    routing_summary: describeTsunamiRoutingMatrix(),
    python: pickPythonExecutable(),
    wrapper: TSUNAMI_COMPAT_WRAPPER,
    wrapper_route_mode: 'opt_in_only',
  };
}

// Export call for internal tool use
export { call as tsunamiRaw };

export async function tsunamiListWings(): Promise<Record<string, number>> {
  const resp = await call({ cmd: 'list_wings' });
  if (!resp.ok) throw new Error(resp.error);
  return resp.wings ?? {};
}
