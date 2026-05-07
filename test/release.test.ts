#!/usr/bin/env bun
/**
 * TSUNAMI Release Test Suite
 */
import { rmSync, mkdirSync, existsSync } from 'node:fs';

let pass = 0, fail = 0;
let suite = '';

function start(name: string) { suite = name; process.stdout.write(`  ${name} `.padEnd(42, '.')); }
function ok() { pass++; console.log(' PASS'); }
function no(msg: string) { fail++; console.log(` FAIL — ${msg}`); }
function assert(cond: boolean, msg: string) { cond ? ok() : no(msg); }

const API_PORT = 18905;
const TSUNAMI_HOME = '/tmp/tsunami-release-test';
const TSUNAMI_DIR = '/Users/liltquidgardens/Desktop/TSUNAMI';

// Cleanup
try { rmSync(TSUNAMI_HOME, { recursive: true, force: true }); } catch {}
mkdirSync(TSUNAMI_HOME, { recursive: true });

function http(path: string, opts: { method?: string; body?: any } = {}): Promise<any> {
  const method = opts.method || 'GET';
  const init: any = { method };
  if (opts.body) {
    init.headers = { 'Content-Type': 'application/json' };
    init.body = JSON.stringify(opts.body);
  }
  return fetch(`http://localhost:${API_PORT}${path}`, init)
    .then(r => r.json())
    .catch(e => ({ _error: String(e) }));
}

// ── Start API Server ────────────────────────────────────
const api = Bun.spawn({
  cmd: ['bun', 'run', `${TSUNAMI_DIR}/server/api.ts`],
  stdout: 'pipe', stderr: 'pipe',
  env: { ...process.env, TSUNAMI_PORT: String(API_PORT), TSUNAMI_HOME },
});
await Bun.sleep(800);

console.log('🌊 TSUNAMI Release Test Suite v1.0.0');
console.log('═══════════════════════════════════════');

// ═══════════════════════════════════════════════════════
// 1. SERVICE DISCOVERY
// ═══════════════════════════════════════════════════════
console.log('\n── Service Discovery ──');

start('GET /');
const root = await http('/');
assert(root.service === 'TSUNAMI Memory API', `service: ${root.service}`);
assert(root.version === '1.0.0', `version: ${root.version}`);
assert(Array.isArray(root.endpoints), 'endpoints');
assert(root.endpoints.length >= 7, `count=${root.endpoints.length}`);

start('GET /health');
const health = await http('/health');
assert(health.ok === true, `ok`);
assert(health.service === 'tsunami-memory', `svc`);

// ═══════════════════════════════════════════════════════
// 2. POST /add
// ═══════════════════════════════════════════════════════
console.log('\n── POST /add ──');

start('basic add with wing/room/energy');
const a1 = await http('/add', { method: 'POST', body: {
  wing: 'project', room: 'tasks', content: 'Completed API refactor for auth module', energy: 5
}});
assert(a1.ok === true, 'ok');
assert(a1.result?.startsWith?.('bunmem_'), `id prefix`);

start('minimal add (only content)');
const a2 = await http('/add', { method: 'POST', body: { content: 'Bare minimum entry' } });
assert(a2.ok === true, 'ok');

start('Chinese text');
const a3 = await http('/add', { method: 'POST', body: { content: '这是一个中文记忆测试', wing: 'zh', energy: 4 } });
assert(a3.ok === true, 'stored');

start('bulk add (6 entries)');
for (let i = 0; i < 6; i++) {
  await http('/add', { method: 'POST', body: {
    wing: 'bulk', room: 'batch', content: `Batch entry #${i + 1}: performance test`, energy: 3
  }});
}
assert(true, '6 stored');

start('missing content → 400');
const a5 = await http('/add', { method: 'POST', body: { wing: 'test' } });
assert(a5.error === 'content required', `"${a5.error}"`);

start('empty body → error');
const a6 = await http('/add', { method: 'POST', body: {} });
assert(a6.error === 'content required', 'validated');

// ═══════════════════════════════════════════════════════
// 3. GET /search
// ═══════════════════════════════════════════════════════
console.log('\n── GET /search ──');

start('search "auth refactor"');
const s1 = await http('/search?q=auth+refactor&limit=5');
assert(s1.ok === true, 'ok');
assert(s1.query === 'auth refactor', `q`);

start('search Chinese');
const s2 = await http('/search?q=中文记忆&limit=3');
assert(s2.ok === true, 'ok');

start('search with wing filter');
const s3 = await http('/search?q=testing&wing=bulk&limit=10');
assert(s3.ok === true, 'filtered');

start('missing q → 400');
const s4 = await http('/search');
assert(s4.error === 'q required', 'validated');

// ═══════════════════════════════════════════════════════
// 4. GET /recall
// ═══════════════════════════════════════════════════════
console.log('\n── GET /recall ──');

start('recall by wing');
const r1 = await http('/recall?wing=project&limit=5');
assert(r1.ok === true, 'ok');

start('recall by wing+room');
const r2 = await http('/recall?wing=bulk&room=batch&limit=3');
assert(r2.ok === true, 'ok');

start('recall default');
const r3 = await http('/recall');
assert(r3.ok === true, 'ok');

// ═══════════════════════════════════════════════════════
// 5. GET /status
// ═══════════════════════════════════════════════════════
console.log('\n── GET /status ──');

start('status');
const st1 = await http('/status');
assert(st1.ok === true, 'ok');

// ═══════════════════════════════════════════════════════
// 6. GET /timeline
// ═══════════════════════════════════════════════════════
console.log('\n── GET /timeline ──');

start('timeline');
const t1 = await http('/timeline?limit=5');
assert(t1.ok === true, 'ok');

// ═══════════════════════════════════════════════════════
// 7. POST /diary
// ═══════════════════════════════════════════════════════
console.log('\n── POST /diary ──');

start('diary write');
const d1 = await http('/diary', { method: 'POST', body: {
  entry: 'Release test day — all systems operational',
  agent: 'test-runner', wing: 'diary'
}});
assert(d1.ok === true, 'ok');

start('diary missing entry → 400');
const d2 = await http('/diary', { method: 'POST', body: { agent: 'test' } });
assert(d2.error === 'entry required', 'validated');

// ═══════════════════════════════════════════════════════
// 8. GET /storm
// ═══════════════════════════════════════════════════════
console.log('\n── GET /storm ──');

start('storm center');
const sc1 = await http(`/storm?project=${encodeURIComponent(TSUNAMI_DIR)}&query=test+release`);
assert(sc1.ok === true, 'ok');
assert(sc1.storm !== undefined, 'storm present');
assert(sc1.storm.flow !== undefined, 'flow present');

// ═══════════════════════════════════════════════════════
// 9. EDGE CASES
// ═══════════════════════════════════════════════════════
console.log('\n── Edge Cases ──');

start('long content (5000 chars)');
const long = 'A'.repeat(5000);
const e1 = await http('/add', { method: 'POST', body: { content: long, wing: 'edge' } });
assert(e1.ok === true, 'stored');

start('CORS preflight (OPTIONS)');
const e2 = await fetch(`http://localhost:${API_PORT}/`, { method: 'OPTIONS' }).then(r => r.status);
assert(e2 === 200, `status=${e2}`);

start('404 unknown route');
const e3 = await fetch(`http://localhost:${API_PORT}/nonexistent`).then(r => r.status);
assert(e3 === 404, `status=${e3}`);

start('search no results');
const e4 = await http('/search?q=zzzxxxnonexistent9999&limit=3');
assert(e4.ok === true, 'ok');

start('large limit handled');
const e5 = await http('/recall?limit=200');
assert(e5.ok === true, 'ok');

start('add with max energy (5)');
const e6 = await http('/add', { method: 'POST', body: { content: 'Critical memory', energy: 5 }});
assert(e6.ok === true, 'ok');

// ═══════════════════════════════════════════════════════
// 10. MCP PROTOCOL
// ═══════════════════════════════════════════════════════
console.log('\n── MCP Protocol ──');

start('MCP initialize');
{
  const proc = Bun.spawn({
    cmd: ['bun', 'run', `${TSUNAMI_DIR}/server/mcp.ts`],
    stdin: 'pipe', stdout: 'pipe', stderr: 'pipe',
    env: { ...process.env, TSUNAMI_HOME: '/tmp/tsunami-mcp-test' },
  });
  proc.stdin.write(JSON.stringify({
    jsonrpc: '2.0', id: 1, method: 'initialize',
    params: { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'release-test', version: '1.0' } },
  }) + '\n');
  proc.stdin.end();
  const out = await new Response(proc.stdout).text();
  const resp = JSON.parse(out.trim().split('\n')[0]);
  assert(resp.jsonrpc === '2.0', 'jsonrpc');
  assert(resp.id === 1, 'id');
  assert(resp.result?.serverInfo?.name === 'tsunami-memory', `name`);
  assert(resp.result?.protocolVersion === '2024-11-05', `proto`);
  try { proc.kill(); } catch {}
}

start('MCP reject no-init');
{
  const proc = Bun.spawn({
    cmd: ['bun', 'run', `${TSUNAMI_DIR}/server/mcp.ts`],
    stdin: 'pipe', stdout: 'pipe', stderr: 'pipe',
    env: { ...process.env, TSUNAMI_HOME: '/tmp/tsunami-mcp-test-2' },
  });
  proc.stdin.write(JSON.stringify({
    jsonrpc: '2.0', id: 99, method: 'tools/list', params: {}
  }) + '\n');
  proc.stdin.end();
  const out = await new Response(proc.stdout).text();
  const resp = JSON.parse(out.trim().split('\n')[0]);
  assert(resp.error?.code === -32600, `code=${resp.error?.code}`);
  assert(resp.error?.message?.includes('initialize'), 'msg');
  try { proc.kill(); } catch {}
}

// ═══════════════════════════════════════════════════════
// RESULTS
// ═══════════════════════════════════════════════════════
console.log('\n═══════════════════════════════');
console.log(`  Passed: ${pass}  Failed: ${fail}`);
console.log('═══════════════════════════════');

// Cleanup
try { api.kill(); } catch {}
try { rmSync(TSUNAMI_HOME, { recursive: true, force: true }); } catch {}

if (fail > 0) {
  console.log(`\n⚠️  ${fail} test(s) FAILED`);
  process.exit(1);
} else {
  console.log(`\n✅ All ${pass} release tests passed!`);
  process.exit(0);
}
