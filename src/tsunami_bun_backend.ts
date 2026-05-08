import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname } from 'path';

import {
  BUN_MEMORY_DB_PATH,
  addWithEmbedding,
  buildBunMemoryPreview,
  checkBunMemoryDuplicate,
  countBunMemoryEntries,
  deleteBunMemoryEntry,
  getBunMemoryStatus,
  getBunMemoryTaxonomy,
  insertBunMemoryEntry,
  listBunMemoryRoomCounts,
  listBunMemoryTimeline,
  listBunMemoryWingCounts,
  recallBunMemoryRows,
  searchBunMemoryRows,
  searchByVector,
  wakeBunMemoryRows,
} from './bun_memory_store';
import {
  buildTsunamiStormCenter,
  formatTsunamiStormCenterText,
} from './tsunami_storm_center';
import {
  describeTsunamiGraphOntology,
  describeTsunamiTaxonomy,
  formatTsunamiGraphOntologyText,
  formatTsunamiNormalizationText,
  formatTsunamiTaxonomyText,
  normalizeTsunamiTaxonomy,
} from './tsunami_schema';
import {
  buildChineseIndexedContent,
  getTsunamiAaakSpec,
  isChineseHeavyText,
} from './tsunami_chinese_dialect';
import {
  describeTsunamiRoutingMatrix,
} from './tsunami_routing';
import {
  classifyTsunamiText,
  classifyTsunamiTextMulti,
} from './tsunami_classifier';
import {
  readTsunamiIdentity,
} from './tsunami_identity';
import {
  tsunamiGraphAddTriple,
  tsunamiGraphCompatStats,
  tsunamiGraphFindTunnels,
  tsunamiGraphInvalidateTriple,
  tsunamiGraphQueryEntity,
  tsunamiGraphTraverse,
  tsunamiGraphStats,
  tsunamiGraphTimeline,
} from './tsunami_graph_runtime';
import {
  TSUNAMI_IDENTITY_FILE,
  TSUNAMI_LEGACY_FALLBACK_FILE,
} from './tsunami_storage_paths';

function countIdentityTokens(identity: string): number {
  return (identity.match(/[\u4e00-\u9fa5A-Za-z0-9_.-]+/g) ?? []).length;
}

function isBunDrawerId(id: string): boolean {
  return id.startsWith('bunmem_');
}

type LegacyFallbackDrawer = {
  id: string;
  wing: string;
  room: string;
  content: string;
  importance: number;
  ts: number;
};

type LegacyFallbackStore = {
  version: number;
  updatedAt: number;
  drawers: LegacyFallbackDrawer[];
};

function loadLegacyFallbackStore(): LegacyFallbackStore {
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
        .filter((item: any) => item && typeof item.content === 'string')
        .map((item: any) => ({
          id: String(item.id ?? ''),
          wing: String(item.wing ?? 'ats'),
          room: String(item.room ?? 'ats/general'),
          content: String(item.content ?? ''),
          importance: Number(item.importance ?? 3),
          ts: Number(item.ts ?? Date.now()),
        })),
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[TSUNAMI] failed to load legacy fallback store: ${msg}`);
    return { version: 1, updatedAt: Date.now(), drawers: [] };
  }
}

function saveLegacyFallbackStore(store: LegacyFallbackStore): void {
  const dir = dirname(TSUNAMI_LEGACY_FALLBACK_FILE);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  store.updatedAt = Date.now();
  writeFileSync(TSUNAMI_LEGACY_FALLBACK_FILE, JSON.stringify(store, null, 2), 'utf8');
}

function deleteLegacyFallbackDrawer(id: string): boolean {
  const drawerId = String(id ?? '').trim();
  if (!drawerId) return false;
  const store = loadLegacyFallbackStore();
  const nextDrawers = store.drawers.filter((drawer) => drawer.id !== drawerId);
  if (nextDrawers.length === store.drawers.length) return false;
  store.drawers = nextDrawers;
  saveLegacyFallbackStore(store);
  return true;
}

function buildIndexedMemoryContent(content: string, scope: {
  wing?: string;
  room?: string;
  source?: string;
  date?: string;
}): string {
  const raw = String(content ?? '').trim();
  if (!raw) return raw;
  if (!isChineseHeavyText(raw)) return raw;
  return buildChineseIndexedContent(raw, {
    wing: scope.wing,
    room: scope.room,
    source_file: scope.source,
    date: scope.date,
  });
}

function resolveEntryScope(entry: Record<string, unknown>, fallback: {
  wing: string;
  room: string;
}): {
  wing: string;
  room: string;
  basin: string;
  current: string;
} {
  const normalized = normalizeTsunamiTaxonomy({
    wing: String(entry.wing ?? '').trim() || fallback.wing,
    room: String(entry.room ?? '').trim() || fallback.room,
    basin: String(entry.basin ?? '').trim() || undefined,
    current: String(entry.current ?? '').trim() || undefined,
  });
  return normalized;
}

export function tryHandleTsunamiBunRequest(req: Record<string, unknown>): any | null {
  const cmd = String(req.cmd ?? '').trim();
  const normalizedScope = normalizeTsunamiTaxonomy({
    wing: String(req.wing ?? '').trim() || undefined,
    room: String(req.room ?? '').trim() || undefined,
    basin: String(req.basin ?? '').trim() || undefined,
    current: String(req.current ?? '').trim() || undefined,
  });
  const wing = normalizedScope.wing;
  const room = normalizedScope.room;
  const total = countBunMemoryEntries(wing || undefined);

  if (cmd === 'tsunami_taxonomy') {
    return {
      ok: true,
      data: describeTsunamiTaxonomy(),
      text: formatTsunamiTaxonomyText(),
      __backend: 'bun_native',
    };
  }

  if (cmd === 'tsunami_ontology') {
    return {
      ok: true,
      data: describeTsunamiGraphOntology(),
      text: formatTsunamiGraphOntologyText(),
      __backend: 'bun_native',
    };
  }

  if (cmd === 'normalize_taxonomy') {
    return {
      ok: true,
      data: normalizedScope,
      text: formatTsunamiNormalizationText(req),
      __backend: 'bun_native',
    };
  }

  if (cmd === 'status') {
    const identity = readTsunamiIdentity(TSUNAMI_IDENTITY_FILE);
    const status = getBunMemoryStatus();
    return {
      ok: true,
      data: {
        ...status,
        palace_path: BUN_MEMORY_DB_PATH,
        total_drawers: Number(status.total ?? 0),
        runtime_backend: 'bun_native',
        compatibility_backend: 'python_wrapper_dormant',
        compatibility_route: 'opt_in_only',
        routing_summary: describeTsunamiRoutingMatrix(),
        L0_identity: {
          preview: identity.slice(0, 200),
          tokens: countIdentityTokens(identity),
        },
      },
      __backend: 'bun_native',
    };
  }

  if (cmd === 'add') {
    const rawContent = String(req.content ?? '').trim();
    const indexedContent = buildIndexedMemoryContent(rawContent, {
      wing: wing || 'ats',
      room: room || 'ats/general',
      source: String(req.source ?? 'tsunami_bun_direct').trim() || 'tsunami_bun_direct',
      date: String(req.date ?? '').trim() || undefined,
    });
    const id = insertBunMemoryEntry({
      wing: wing || 'ats',
      room: room || 'ats/general',
      content: indexedContent,
      importance: Number(req.importance ?? 3),
      source: String(req.source ?? 'tsunami_bun_direct').trim() || 'tsunami_bun_direct',
      sessionId: String(req.session_id ?? '').trim() || undefined,
      projectDir: String(req.project_dir ?? '').trim() || undefined,
      fingerprint: String(req.fingerprint ?? '').trim() || undefined,
    });
    return {
      ok: true,
      id,
      runtime_backend: 'bun_native',
      aaak_indexed: indexedContent !== rawContent,
      __backend: 'bun_native',
    };
  }

  if (cmd === 'diary') {
    const agent = String(req.agent ?? 'ats').trim() || 'ats';
    const rawEntry = String(req.entry ?? '').trim();
    const indexedEntry = buildIndexedMemoryContent(rawEntry, {
      wing: wing || 'ats',
      room: `diary-${agent}`,
      source: `tsunami_bun_diary:${agent}`,
      date: String(req.date ?? '').trim() || undefined,
    });
    const id = insertBunMemoryEntry({
      wing: wing || 'ats',
      room: `diary-${agent}`,
      content: indexedEntry,
      importance: Number(req.importance ?? 3),
      source: 'tsunami_bun_diary',
    });
    return {
      ok: true,
      id,
      runtime_backend: 'bun_native',
      aaak_indexed: indexedEntry !== rawEntry,
      __backend: 'bun_native',
    };
  }

  if (cmd === 'mine') {
    const entries = Array.isArray(req.entries) ? req.entries : [];
    let stored = 0;
    let indexed = 0;
    let defaulted = 0;
    const ids: string[] = [];
    for (const rawEntry of entries) {
      if (!rawEntry || typeof rawEntry !== 'object') continue;
      const entry = rawEntry as Record<string, unknown>;
      const text = String(entry.text ?? '').trim();
      if (!text || text.length < 20) continue;
      const scope = resolveEntryScope(entry, {
        wing: wing || 'ats',
        room: room || 'ats/general',
      });
      const source = String(entry.source ?? req.source ?? 'mine').trim() || 'mine';
      const indexedContent = buildIndexedMemoryContent(text, {
        wing: scope.wing,
        room: scope.room,
        source,
        date: String(entry.date ?? req.date ?? '').trim() || undefined,
      });
      const id = insertBunMemoryEntry({
        wing: scope.wing,
        room: scope.room,
        content: indexedContent,
        importance: Number(entry.importance ?? req.importance ?? 3),
        source,
        sessionId: String(entry.session_id ?? req.session_id ?? '').trim() || undefined,
        projectDir: String(entry.project_dir ?? req.project_dir ?? '').trim() || undefined,
      });
      ids.push(id);
      stored += 1;
      if (indexedContent !== text) indexed += 1;
      if (!entry.wing && !entry.room && !entry.basin && !entry.current) defaulted += 1;
    }
    return {
      ok: true,
      stored,
      indexed,
      defaulted,
      ids,
      runtime_backend: 'bun_native',
      __backend: 'bun_native',
    };
  }

  if (cmd === 'kg_add') {
    const subject = String(req.subject ?? '').trim();
    const predicate = String(req.predicate ?? '').trim();
    const object = String(req.object ?? '').trim();
    if (!subject || !predicate || !object) {
      return {
        ok: false,
        error: 'subject / predicate / object are required for kg_add',
        __backend: 'bun_native',
      };
    }
    const id = tsunamiGraphAddTriple({
      subject,
      subjectType: String(req.subject_type ?? '').trim() || undefined,
      subjectProperties: req.subject_properties && typeof req.subject_properties === 'object'
        ? (req.subject_properties as Record<string, unknown>)
        : undefined,
      predicate,
      object,
      objectType: String(req.object_type ?? '').trim() || undefined,
      objectProperties: req.object_properties && typeof req.object_properties === 'object'
        ? (req.object_properties as Record<string, unknown>)
        : undefined,
      validFrom: String(req.valid_from ?? '').trim() || undefined,
      validTo: String(req.valid_to ?? '').trim() || undefined,
      confidence: Number(req.confidence ?? 1.0),
      sourceCloset: String(req.source_closet ?? '').trim() || undefined,
      sourceFile: String(req.source_file ?? '').trim() || undefined,
    });
    return {
      ok: true,
      id,
      runtime_backend: 'bun_native',
      __backend: 'bun_native',
    };
  }

  if (cmd === 'kg_query') {
    const entity = String(req.entity ?? req.query ?? '').trim();
    if (!entity) {
      return {
        ok: false,
        error: 'entity is required for kg_query',
        __backend: 'bun_native',
      };
    }
    const rows = tsunamiGraphQueryEntity(
      entity,
      String(req.as_of ?? '').trim() || undefined,
      (String(req.direction ?? '').trim() || 'outgoing') as 'outgoing' | 'incoming' | 'both',
    );
    return {
      ok: true,
      data: rows,
      text: JSON.stringify(rows, null, 2),
      runtime_backend: 'bun_native',
      __backend: 'bun_native',
    };
  }

  if (cmd === 'kg_invalidate') {
    const subject = String(req.subject ?? '').trim();
    const predicate = String(req.predicate ?? '').trim();
    const object = String(req.object ?? '').trim();
    if (!subject || !predicate || !object) {
      return {
        ok: false,
        error: 'subject / predicate / object are required for kg_invalidate',
        __backend: 'bun_native',
      };
    }
    const changes = tsunamiGraphInvalidateTriple({
      subject,
      predicate,
      object,
      ended: String(req.ended ?? '').trim() || undefined,
    });
    return {
      ok: true,
      data: { changes },
      runtime_backend: 'bun_native',
      __backend: 'bun_native',
    };
  }

  if (cmd === 'kg_stats') {
    return {
      ok: true,
      data: {
        ...tsunamiGraphStats(),
        runtime_backend: 'bun_native',
      },
      __backend: 'bun_native',
    };
  }

  if (cmd === 'traverse_graph') {
    const startRoom = String(req.start_room ?? req.entity ?? req.query ?? '').trim();
    if (!startRoom) {
      return {
        ok: false,
        error: 'start_room is required for traverse_graph',
        __backend: 'bun_native',
      };
    }
    const data = tsunamiGraphTraverse(startRoom, Number(req.max_hops ?? 2));
    return {
      ok: !('error' in data),
      data,
      text: JSON.stringify(data, null, 2),
      runtime_backend: 'bun_native',
      __backend: 'bun_native',
      ...(typeof data === 'object' && data && 'error' in data ? { error: String(data.error ?? 'traverse_graph failed') } : {}),
    };
  }

  if (cmd === 'find_tunnels') {
    const data = tsunamiGraphFindTunnels(
      String(req.wing_a ?? req.basin_a ?? '').trim() || undefined,
      String(req.wing_b ?? req.basin_b ?? '').trim() || undefined,
    );
    return {
      ok: true,
      data,
      text: JSON.stringify(data, null, 2),
      runtime_backend: 'bun_native',
      __backend: 'bun_native',
    };
  }

  if (cmd === 'graph_stats') {
    return {
      ok: true,
      data: {
        ...tsunamiGraphCompatStats(),
        runtime_backend: 'bun_native',
      },
      runtime_backend: 'bun_native',
      __backend: 'bun_native',
    };
  }

  if (cmd === 'get_aaak_spec') {
    return {
      ok: true,
      spec: getTsunamiAaakSpec(),
      runtime_backend: 'bun_native',
      __backend: 'bun_native',
    };
  }

  if (cmd === 'classify' || cmd === 'classify_multi') {
    const text = String(req.text ?? '').trim();
    if (!text) {
      return {
        ok: false,
        error: 'text is required for classify',
        runtime_backend: 'bun_native',
        __backend: 'bun_native',
      };
    }
    const wantsMulti = cmd === 'classify_multi' || req.multi === true;
    if (wantsMulti) {
      return {
        ok: true,
        results: classifyTsunamiTextMulti(text, Number(req.top ?? 3)).map((entry) => ({
          ...entry,
          confidence: Number(entry.confidence.toFixed(2)),
        })),
        runtime_backend: 'bun_native',
        __backend: 'bun_native',
      };
    }
    const result = classifyTsunamiText(text);
    return {
      ok: true,
      ...result,
      confidence: Number(result.confidence.toFixed(2)),
      runtime_backend: 'bun_native',
      __backend: 'bun_native',
    };
  }

  if (cmd === 'kg_timeline') {
    const entity = String(req.entity ?? req.query ?? '').trim() || undefined;
    const rows = tsunamiGraphTimeline(entity, Number(req.limit ?? 20)).map((row) => ({
      ...row,
      runtime_backend: 'bun_native',
    }));
    return {
      ok: true,
      data: rows,
      runtime_backend: 'bun_native',
      __backend: 'bun_native',
    };
  }

  if (cmd === 'storm_center') {
    const center = buildTsunamiStormCenter({
      projectDir: String(req.project_dir ?? '').trim() || process.cwd(),
      query: String(req.query ?? '').trim() || undefined,
      sessionId: String(req.session_id ?? '').trim() || undefined,
      refreshGraph: req.refresh_graph !== false,
      evidenceLimit: Number(req.evidence_limit ?? 4),
      signalLimit: Number(req.signal_limit ?? 4),
      relationLimit: Number(req.relation_limit ?? 10),
    });
    return {
      ok: true,
      data: center,
      text: formatTsunamiStormCenterText(center),
      runtime_backend: 'bun_native',
      __backend: 'bun_native',
    };
  }

  if (cmd === 'wakeup') {
    const scopeWing = wing || undefined;
    const rows = wakeBunMemoryRows({ wing: scopeWing });
    const identity = readTsunamiIdentity(TSUNAMI_IDENTITY_FILE);
    const topWings = Object.entries(listBunMemoryWingCounts())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, count]) => `${name}:${count}`)
      .join(' / ') || 'none';
    const highlights = rows.map((row, index) => `  [${index + 1}] ${row.wing}/${row.room} ${buildBunMemoryPreview(row, 120)}`);
    return {
      ok: true,
      data: [
        '## L0 — IDENTITY',
        identity,
        '',
        '## L1 — ESSENTIAL STORY',
        'backend=bun-native',
        `total=${countBunMemoryEntries(scopeWing)}`,
        `tsunami=${normalizedScope.basin}/${normalizedScope.current}`,
        `top_wings=${topWings}`,
        '',
        ...highlights,
      ].join('\n'),
      __backend: 'bun_native',
    };
  }

  if (cmd === 'search') {
    const query = String(req.query ?? '').trim();
    const rows = searchBunMemoryRows({
      query,
      wing: wing || undefined,
      room: room || undefined,
      limit: Number(req.limit ?? 5),
    });
    const lines = [`## L3 — SEARCH RESULTS for "${query}"`, 'backend=bun-native', `tsunami=${normalizedScope.basin}/${normalizedScope.current}`];
    if (rows.length === 0) {
      lines.push('  (no results)');
    } else {
      rows.forEach((row, index) => {
        lines.push(`  [${index + 1}] ${row.wing}/${row.room}`);
        lines.push(`      ${buildBunMemoryPreview(row, 200)}`);
      });
    }
    return { ok: true, data: lines.join('\n'), __backend: 'bun_native' };
  }

  if (cmd === 'recall') {
    const rows = recallBunMemoryRows({
      wing: wing || undefined,
      room: room || undefined,
      limit: Number(req.limit ?? 10),
    });
    const lines = ['## L2 — RECALL', 'backend=bun-native', `tsunami=${normalizedScope.basin}/${normalizedScope.current}`];
    if (rows.length === 0) {
      lines.push('  (no memories)');
    } else {
      rows.forEach((row, index) => {
        lines.push(`  [${index + 1}] ${row.wing}/${row.room}`);
        lines.push(`      ${buildBunMemoryPreview(row, 220)}`);
      });
    }
    return { ok: true, data: lines.join('\n'), __backend: 'bun_native' };
  }

  if (cmd === 'timeline') {
    return {
      ok: true,
      data: listBunMemoryTimeline(Number(req.limit ?? 20)).map((row) => ({
        ...row,
        runtime_backend: 'bun_native',
      })),
      __backend: 'bun_native',
    };
  }

  if (cmd === 'list_wings') {
    return {
      ok: true,
      wings: listBunMemoryWingCounts(),
      __backend: 'bun_native',
    };
  }

  if (cmd === 'list_rooms') {
    return {
      ok: true,
      wing: wing ?? 'all',
      basin: normalizedScope.basin,
      current: normalizedScope.current,
      rooms: listBunMemoryRoomCounts(wing || undefined),
      __backend: 'bun_native',
    };
  }

  if (cmd === 'get_taxonomy') {
    return {
      ok: true,
      taxonomy: getBunMemoryTaxonomy(),
      tsunami: describeTsunamiTaxonomy(),
      __backend: 'bun_native',
    };
  }

  if (cmd === 'check_duplicate') {
    return {
      ok: true,
      ...checkBunMemoryDuplicate(String(req.content ?? ''), Number(req.threshold ?? 0.9)),
      __backend: 'bun_native',
    };
  }

  if (cmd === 'delete_drawer') {
    const drawerId = String(req.drawer_id ?? '').trim();
    if (!drawerId) {
      return {
        ok: false,
        error: 'drawer_id is required for delete_drawer',
        __backend: 'bun_native',
      };
    }
    if (deleteBunMemoryEntry(drawerId)) {
      return {
        ok: true,
        deleted_id: drawerId,
        deleted_from: isBunDrawerId(drawerId) ? 'bun_memory' : 'bun_memory_legacy_id',
        __backend: 'bun_native',
      };
    }
    if (deleteLegacyFallbackDrawer(drawerId)) {
      return {
        ok: true,
        deleted_id: drawerId,
        deleted_from: 'legacy_fallback_store',
        __backend: 'bun_native',
      };
    }
    if (!isBunDrawerId(drawerId)) {
      return { ok: false, error: `Drawer not found: ${drawerId}`, __backend: 'bun_native' };
    }
    return { ok: false, error: `Drawer not found: ${drawerId}`, __backend: 'bun_native' };
  }

  if (cmd === 'diary_read') {
    const agent = String(req.agent ?? 'ats').trim() || 'ats';
    const rows = recallBunMemoryRows({
      room: `diary-${agent}`,
      limit: Number(req.last_n ?? 10),
    });
    return {
      ok: true,
      entries: rows.map((row) => ({
        id: row.id,
        date: new Date(row.created_at).toISOString(),
        topic: row.room,
        content: row.content,
      })),
      __backend: 'bun_native',
    };
  }

  if (cmd === 'add_embedding') {
    const embedding = Array.isArray(req.embedding) ? (req.embedding as number[]) : [];
    if (embedding.length === 0) {
      return { ok: false, error: 'embedding vector required (number[])', __backend: 'bun_native' };
    }
    const id = addWithEmbedding(
      wing || 'general', room || 'inbox',
      String(req.content ?? '').trim(),
      Number(req.importance ?? 3),
      embedding,
    );
    return { ok: true, id, __backend: 'bun_native' };
  }

  if (cmd === 'search_vector') {
    const vector = Array.isArray(req.embedding) ? (req.embedding as number[]) : [];
    if (vector.length === 0) {
      return { ok: false, error: 'embedding vector required for search_vector', __backend: 'bun_native' };
    }
    const results = searchByVector(vector, Number(req.limit ?? 5), wing || undefined);
    return { ok: true, results, __backend: 'bun_native' };
  }

  return null;
}
