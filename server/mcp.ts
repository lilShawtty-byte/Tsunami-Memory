#!/usr/bin/env bun
/**
 * TSUNAMI MCP Server — Model Context Protocol
 *
 * Any MCP-compatible agent (Claude Code, Cursor, Windsurf, Codex, Hermes) can connect.
 * Example config (~/.claude/mcp.json):
 *   { "tsunami": { "command": "bun", "args": ["run", "server/mcp.ts"] } }
 *
 * Exposes 8 MCP tools: tsunami_add, tsunami_search, tsunami_recall, tsunami_storm,
 *   tsunami_status, tsunami_timeline, tsunami_diary, tsunami_wings
 */

const HOME = process.env.TSUNAMI_HOME || '.tsunami';

// ── JSON-RPC 2.0 over stdio ────────────────────────────────
async function readStdin(): Promise<any> {
  const buf = await Bun.stdin.stream().getReader().read();
  if (!buf.value) return null;
  const text = new TextDecoder().decode(buf.value);
  if (!text.trim()) return null;
  try { return JSON.parse(text); } catch { return null; }
}

function writeStdout(data: any): void {
  process.stdout.write(JSON.stringify(data) + '\n');
}

function ok(id: number, result: any) {
  writeStdout({ jsonrpc: '2.0', id, result });
}

function err(id: number, code: number, message: string) {
  writeStdout({ jsonrpc: '2.0', id, error: { code, message } });
}

// ── Tool Definitions ───────────────────────────────────────
const TOOLS = [
  {
    name: 'tsunami_add',
    description: 'Add a memory to TSUNAMI. Returns confirmation with the stored content.',
    inputSchema: {
      type: 'object',
      properties: {
        content: { type: 'string', description: 'Memory content to store' },
        wing: { type: 'string', description: 'Memory wing/basin (default: general)', default: 'general' },
        room: { type: 'string', description: 'Room/topic within the wing (default: inbox)', default: 'inbox' },
        energy: { type: 'number', description: 'Energy/importance level 1-5 (default: 3)', default: 3 },
      },
      required: ['content'],
    },
  },
  {
    name: 'tsunami_search',
    description: 'Full-text search across TSUNAMI memories. Returns ranked results.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search query' },
        wing: { type: 'string', description: 'Filter by wing/basin' },
        limit: { type: 'number', description: 'Max results (default: 5)', default: 5 },
      },
      required: ['query'],
    },
  },
  {
    name: 'tsunami_recall',
    description: 'Recall recent memories from a specific wing or room. Context-aware retrieval.',
    inputSchema: {
      type: 'object',
      properties: {
        wing: { type: 'string', description: 'Memory wing/basin to recall from' },
        room: { type: 'string', description: 'Specific room/topic' },
        limit: { type: 'number', description: 'Max results (default: 10)', default: 10 },
      },
    },
  },
  {
    name: 'tsunami_storm',
    description: 'Get the TSUNAMI storm center — active signals, memory flow, execution budget, and storm mode. Use this to understand current context.',
    inputSchema: {
      type: 'object',
      properties: {
        projectDir: { type: 'string', description: 'Project directory for context' },
        query: { type: 'string', description: 'Current task/query for relevance' },
      },
    },
  },
  {
    name: 'tsunami_status',
    description: 'Get TSUNAMI system status — storage size, memory counts per wing, graph stats.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'tsunami_timeline',
    description: 'Get a timeline of recent memories.',
    inputSchema: {
      type: 'object',
      properties: {
        limit: { type: 'number', description: 'Max entries (default: 20)', default: 20 },
      },
    },
  },
  {
    name: 'tsunami_diary',
    description: 'Write a diary entry to TSUNAMI. Automatically timestamped.',
    inputSchema: {
      type: 'object',
      properties: {
        entry: { type: 'string', description: 'Diary entry content' },
        agent: { type: 'string', description: 'Agent name (default: external)', default: 'external' },
        wing: { type: 'string', description: 'Memory wing (default: diary)', default: 'diary' },
      },
      required: ['entry'],
    },
  },
  {
    name: 'tsunami_wings',
    description: 'List all available memory wings/basins and their memory counts.',
    inputSchema: { type: 'object', properties: {} },
  },
];

// ── Tool Handlers ──────────────────────────────────────────
async function handleTool(name: string, args: Record<string, any>): Promise<any> {
  // Dynamic import to defer heavy module loading
  const client = await import('../src/tsunami_client');
  const storm = await import('../src/tsunami_storm_center');

  switch (name) {
    case 'tsunami_add':
      return { result: await client.tsunamiAdd(args.wing || 'general', args.room || 'inbox', args.content, args.energy || 3) };

    case 'tsunami_search':
      return { result: await client.tsunamiSearch(args.query, args.wing, undefined, args.limit || 5) };

    case 'tsunami_recall':
      return { result: await client.tsunamiRecall(args.wing, args.room, args.limit || 10) };

    case 'tsunami_storm': {
      const center = storm.buildTsunamiStormCenter({
        projectDir: args.projectDir || process.cwd(),
        query: args.query || '',
        refreshGraph: false,
      });
      return {
        flow: center.flow,
        stormMode: center.stormMode,
        stormPressure: center.stormPressure,
        stormGate: center.stormGate,
        stormBudget: center.stormBudget,
        stormAction: center.stormAction,
        summary: storm.formatTsunamiStormCenterText(center),
      };
    }

    case 'tsunami_status': {
      const s = await client.tsunamiStatus();
      return { ...s };
    }

    case 'tsunami_timeline':
      return { timeline: await client.tsunamiTimeline(args.limit || 20) };

    case 'tsunami_diary':
      return { result: await client.tsunamiDiary(args.entry, args.agent || 'external', args.wing || 'diary', 3) };

    case 'tsunami_wings': {
      const wings = await client.tsunamiListWings();
      return { wings };
    }

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

// ── Main Loop ──────────────────────────────────────────────
async function main() {
  // MCP initialization handshake
  const initReq = await readStdin();
  if (!initReq || initReq.method !== 'initialize') {
    err(initReq?.id || 0, -32600, 'Expected initialize request');
    process.exit(1);
  }
  ok(initReq.id, {
    protocolVersion: '2024-11-05',
    serverInfo: { name: 'tsunami-memory', version: '1.0.0' },
    capabilities: { tools: {} },
  });

  // Main loop: handle tools/list and tools/call
  while (true) {
    const req = await readStdin();
    if (!req) break; // stdin closed

    try {
      switch (req.method) {
        case 'tools/list':
          ok(req.id, { tools: TOOLS });
          break;

        case 'tools/call': {
          const result = await handleTool(req.params?.name, req.params?.arguments || {});
          ok(req.id, { content: [{ type: 'text', text: typeof result === 'string' ? result : JSON.stringify(result, null, 2) }] });
          break;
        }

        case 'notifications/initialized':
          // Acknowledge silently — no response needed per MCP spec
          break;

        default:
          err(req.id, -32601, `Method not found: ${req.method}`);
      }
    } catch (e: any) {
      err(req.id, -32000, e?.message || String(e));
    }
  }
}

main().catch(e => { console.error(e); process.exit(1); });
