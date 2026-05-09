/**
 * TSUNAMI HTTP API Server — universal memory backend for any agent
 *
 * Start: bun run server/api.ts
 * Port: 18904 (configurable via TSUNAMI_PORT)
 *
 * Endpoints:
 *   POST /add        — Add memory
 *   GET  /search?q=  — Search memories
 *   GET  /recall?wing=&limit= — Recall by context
 *   GET  /storm?project=&query= — Storm center
 *   GET  /status      — System status
 *   GET  /timeline?limit= — Timeline
 *   POST /diary       — Write diary entry
 *   GET  /health      — Health check
 */

const PORT = parseInt(process.env.TSUNAMI_PORT || '18904');

// Lightweight HTTP server — zero external deps (Bun native)
const server = Bun.serve({
  port: PORT,
  async fetch(req) {
    const url = new URL(req.url);
    const cors = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    if (req.method === 'OPTIONS') return new Response(null, { headers: cors });

    try {
      // Dynamic import to defer heavy module loading
      const { tsunamiAdd, tsunamiSearch, tsunamiRecall, tsunamiStatus, tsunamiTimeline, tsunamiDiary } = await import('../src/tsunami_client');
      const { buildTsunamiStormCenter, formatTsunamiStormCenterText } = await import('../src/tsunami_storm_center');

      // ── Health ──────────────────────────────────────
      if (url.pathname === '/health') {
        return json({ ok: true, service: 'tsunami-memory', port: PORT }, cors);
      }

      // ── POST /add ───────────────────────────────────
      if (url.pathname === '/add' && req.method === 'POST') {
        const body = await req.json().catch(() => ({}));
        const { wing, room, content, energy } = body;
        if (!content) return json({ error: 'content required' }, cors, 400);
        const result = await tsunamiAdd(wing || 'default', room || 'general', content, energy || 3);
        return json({ ok: true, result }, cors);
      }

      // ── GET /search?q=&wing=&limit= ─────────────────
      if (url.pathname === '/search' && req.method === 'GET') {
        const q = url.searchParams.get('q') || '';
        const wing = url.searchParams.get('wing') || undefined;
        const limit = parseInt(url.searchParams.get('limit') || '5');
        if (!q) return json({ error: 'q required' }, cors, 400);
        const result = await tsunamiSearch(q, wing, undefined, limit);
        return json({ ok: true, query: q, result }, cors);
      }

      // ── GET /recall?wing=&room=&limit= ──────────────
      if (url.pathname === '/recall' && req.method === 'GET') {
        const wing = url.searchParams.get('wing') || undefined;
        const room = url.searchParams.get('room') || undefined;
        const limit = parseInt(url.searchParams.get('limit') || '10');
        const result = await tsunamiRecall(wing, room, limit);
        return json({ ok: true, result }, cors);
      }

      // ── GET /storm?project=&query= ──────────────────
      if (url.pathname === '/storm' && req.method === 'GET') {
        const projectDir = url.searchParams.get('project') || process.cwd();
        const query = url.searchParams.get('query') || '';
        const center = buildTsunamiStormCenter({ projectDir, query, refreshGraph: false });
        return json({ ok: true, storm: { flow: center.flow, mode: center.stormMode, pressure: center.stormPressure, gate: center.stormGate, budget: center.stormBudget, text: formatTsunamiStormCenterText(center) } }, cors);
      }

      // ── GET /status ─────────────────────────────────
      if (url.pathname === '/status' && req.method === 'GET') {
        const result = await tsunamiStatus();
        return json({ ok: true, ...result }, cors);
      }

      // ── GET /timeline?limit= ────────────────────────
      if (url.pathname === '/timeline' && req.method === 'GET') {
        const limit = parseInt(url.searchParams.get('limit') || '20');
        const result = await tsunamiTimeline(limit);
        return json({ ok: true, timeline: result }, cors);
      }

      // ── POST /search/hybrid ──────────────────────────
      if (url.pathname === '/search/hybrid' && req.method === 'POST') {
        const body = await req.json().catch(() => ({}));
        const { query, embedding, wing, limit, weights } = body;
        if (!query?.trim()) return json({ error: 'query required' }, cors, 400);
        const store = await import('../src/bun_memory_store');
        const results = store.searchHybrid(query, embedding, limit || 5, wing, weights);
        return json({ ok: true, results }, cors);
      }

      // ── POST /search/semantic ────────────────────────
      if (url.pathname === '/search/semantic' && req.method === 'POST') {
        const body = await req.json().catch(() => ({}));
        const { embedding, wing, limit } = body;
        if (!Array.isArray(embedding) || embedding.length === 0) {
          return json({ error: 'embedding vector required (number[])' }, cors, 400);
        }
        const store = await import('../src/bun_memory_store');
        const results = store.searchByVector(embedding, limit || 5, wing);
        return json({ ok: true, results }, cors);
      }

      // ── GET /history/:id ────────────────────────────
      const histMatch = url.pathname.match(/^\/history\/(.+)$/);
      if (histMatch && req.method === 'GET') {
        const store = await import('../src/bun_memory_store');
        const history = store.getEntryHistory(histMatch[1]);
        return json({ ok: true, history }, cors);
      }

      // ── GET /changes?wing=&limit= ─────────────────────
      if (url.pathname === '/changes' && req.method === 'GET') {
        const store = await import('../src/bun_memory_store');
        const wing = url.searchParams.get('wing') || undefined;
        const limit = parseInt(url.searchParams.get('limit') || '20');
        const changes = store.getRecentChanges(wing, limit);
        return json({ ok: true, changes }, cors);
      }

      // ── POST /diary ─────────────────────────────────
      if (url.pathname === '/diary' && req.method === 'POST') {
        const body = await req.json().catch(() => ({}));
        const { entry, agent, wing, importance } = body;
        if (!entry) return json({ error: 'entry required' }, cors, 400);
        const result = await tsunamiDiary(entry, agent || 'external', wing || 'diary', importance || 3);
        return json({ ok: true, result }, cors);
      }

      // ── GET / ───────────────────────────────────────
      if (url.pathname === '/' && req.method === 'GET') {
        return json({
          service: 'TSUNAMI Memory API',
          version: '1.0.0',
          endpoints: ['/health', '/add', '/search', '/search/semantic', '/recall', '/storm', '/status', '/timeline', '/diary'],
        }, cors);
      }

      return new Response('Not Found', { status: 404, headers: cors });
    } catch (err: any) {
      return json({ error: err?.message || String(err) }, cors, 500);
    }
  },
});

function json(data: any, headers: Record<string, string>, status = 200): Response {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: { ...headers, 'Content-Type': 'application/json' },
  });
}

console.log(`🌊 TSUNAMI Memory API running on http://localhost:${PORT}`);
console.log(`   Try: curl http://localhost:${PORT}/`);
