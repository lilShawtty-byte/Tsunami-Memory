<p align="center">
  <img src="https://img.shields.io/badge/Status-Active-2ea44f?style=for-the-badge" alt="Status">
  <img src="https://img.shields.io/badge/Bun-%3E%3D1.0.0-fbf0df?style=for-the-badge&logo=bun&logoColor=000" alt="Bun">
  <img src="https://img.shields.io/badge/License-MIT-yellow?style=for-the-badge" alt="License">
  <img src="https://img.shields.io/badge/Dependencies-zero-blue?style=for-the-badge" alt="Dependencies">
</p>

<p align="center">
  <a href="README.zh-CN.md">中文</a>
</p>

<p align="center">
  <pre align="center">
    ████████╗███████╗██╗   ██╗███╗   ██╗ █████╗ ███╗   ███╗██╗
    ╚══██╔══╝██╔════╝██║   ██║████╗  ██║██╔══██╗████╗ ████║██║
       ██║   ███████╗██║   ██║██╔██╗ ██║███████║██╔████╔██║██║
       ██║   ╚════██║██║   ██║██║╚██╗██║██╔══██║██║╚██╔╝██║██║
       ██║   ███████║╚██████╔╝██║ ╚████║██║  ██║██║ ╚═╝ ██║██║
       ╚═╝   ╚══════╝ ╚═════╝ ╚═╝  ╚═══╝╚═╝  ╚═╝╚═╝     ╚═╝╚═╝
  </pre>
</p>

<p align="center"><strong>Oceanic Memory System for AI Agents</strong></p>

<p align="center">Bun-native runtime — SQLite FTS5 full-text search · Knowledge graph · Storm center analysis · MCP / HTTP / SDK</p>

---

## Table of Contents

- [Architecture](#architecture)
- [Installation](#installation)
- [Quick Start](#quick-start)
- [Usage Guide](#usage-guide)
  - [Interface A: MCP Tools](#interface-a-mcp-tools-claude-code--cursor--windsurf)
  - [Interface B: HTTP API](#interface-b-http-api-any-language)
  - [Interface C: TypeScript SDK](#interface-c-typescript-sdk-programmatic)
- [Automatic Memory](#automatic-memory)
- [Core Concepts](#core-concepts)
- [Configuration](#configuration)
- [License](#license)

---

## Architecture

```
TSUNAMI Memory Model
├── Basin — Topic areas grouping related memories
│   ├── project   — ongoing work context
│   ├── feedback  — corrections & preferences
│   ├── reference — external system knowledge
│   └── user      — user profile & identity
│
├── Current — Active flow within a basin
│   └── Tracks which topic is the current focus
│
├── Storm Center — Focused view of active signals
│   ├── Active signals with energy levels
│   ├── Recent evidence with confidence scores
│   ├── Storm mode detection (dominant kind + pressure)
│   └── Execution gate (budget control per task)
│
├── Hot + Cold Retrieval
│   ├── Hot: SQLite FTS5 full-text search (sub-millisecond)
│   └── Cold: knowledge graph traversal (semantic)
│
└── Runtime Graph Sync
    ├── Auto-syncs memories across sessions
    └── Conflict detection + evidence linking
```

---

## Installation

```bash
bun install
```

> **Requirements:** Bun >= 1.0.0. SQLite is built into Bun — **zero external runtime dependencies**.

---

## Quick Start

### 1. Start the server

```bash
bun run server/api.ts
# → 🌊 TSUNAMI Memory API running on http://localhost:18904
```

### 2. Add a memory

```bash
curl -X POST http://localhost:18904/add \
  -H 'Content-Type: application/json' \
  -d '{"wing":"project","room":"tasks","content":"Completed API refactor","energy":5}'
# → {"ok":true,"result":"bunmem_abc123..."}
```

### 3. Search with FTS5

```bash
curl 'http://localhost:18904/search?q=API+refactor&limit=5'
```

### 4. Check storm center

```bash
curl 'http://localhost:18904/storm?query=continue+work'
# → {"ok":true,"storm":{"flow":{"basin":"surface",...},"stormMode":{...}}}
```

---

## Usage Guide

TSUNAMI exposes three interfaces. Pick the one that fits your stack.

### Interface A: MCP Tools (Claude Code / Cursor / Windsurf)

Configure once in `~/.claude/mcp.json`:

```json
{
  "mcpServers": {
    "tsunami": {
      "command": "bun",
      "args": ["run", "/path/to/TSUNAMI/server/mcp.ts"],
      "env": { "TSUNAMI_HOME": "~/.tsunami" }
    }
  }
}
```

Eight tools available in any MCP-compatible client:

| Tool | When to use | Example |
|------|-------------|---------|
| `tsunami_add` | Store a fact, decision, or observation | `{content:"Decided to use Redis", wing:"decision", energy:4}` |
| `tsunami_search` | Find memories by keyword | `{query:"Redis cache", limit:5}` |
| `tsunami_recall` | Pull recent memories from a topic | `{wing:"project", limit:10}` |
| `tsunami_storm` | Get current context before starting work | `{query:"continue the API work"}` |
| `tsunami_status` | Check memory store health | `{}` |
| `tsunami_timeline` | Chronological memory feed | `{limit:20}` |
| `tsunami_diary` | Log a session or daily entry | `{entry:"Today I built...", agent:"claude"}` |
| `tsunami_wings` | List all topic areas and counts | `{}` |

> **Note:** The MCP server starts automatically when Claude Code launches. No separate process management needed.

### Interface B: HTTP API (any language)

```bash
TSUNAMI_PORT=18904 TSUNAMI_HOME=~/.tsunami bun run server/api.ts
```

All endpoints return JSON. Missing required fields return HTTP 400.

| Method | Path | Body / Query |
|--------|------|-------------|
| `POST` | `/add` | `{wing, room, content, energy}` |
| `GET` | `/search` | `?q=&wing=&limit=` |
| `GET` | `/recall` | `?wing=&room=&limit=` |
| `GET` | `/storm` | `?project=&query=` |
| `GET` | `/status` | — |
| `GET` | `/timeline` | `?limit=` |
| `POST` | `/diary` | `{entry, agent, wing}` |
| `GET` | `/health` | — |

**Add parameters:**

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `wing` | string | `"general"` | Topic basin |
| `room` | string | `"inbox"` | Sub-topic within the wing |
| `content` | string | **(required)** | Memory text. Supports Chinese, emoji, any Unicode |
| `energy` | number `1–5` | `3` | Importance. 5 = critical, 1 = footnote |

<table>
<tr><td width="33%">

**Shell**

```bash
curl -X POST localhost:18904/add \
  -H 'Content-Type: application/json' \
  -d '{"wing":"project",
       "content":"Refactored auth",
       "energy":4}'
curl 'localhost:18904/search?q=auth&limit=5'
```

</td><td width="33%">

**Python**

```python
import requests
r = requests.post(
  'http://localhost:18904/add',
  json={'wing': 'feedback',
        'content': 'User prefers dark mode',
        'energy': 5}
)
r = requests.get(
  'http://localhost:18904/search',
  params={'q': 'dark mode', 'limit': 3}
)
```

</td><td width="33%">

**TypeScript**

```typescript
const r = await fetch(
  'http://localhost:18904/add', {
  method: 'POST',
  headers: {'Content-Type': 'application/json'},
  body: JSON.stringify({
    wing: 'reference',
    content: 'Bun sqlite API docs',
    energy: 3})
});
const { result } = await r.json();
```

</td></tr>
</table>

### Interface C: TypeScript SDK (programmatic)

```typescript
import {
  tsunamiAdd, tsunamiSearch, tsunamiRecall,
  tsunamiWakeUp, tsunamiDiary, tsunamiStatus,
  tsunamiTimeline, tsunamiListWings,
  tsunamiKgAdd, tsunamiKgQuery, tsunamiKgStats, tsunamiKgTimeline,
  buildTsunamiStormCenter, formatTsunamiStormCenterText,
  buildTsunamiExecutionGate, applyTsunamiExecutionGateToTool,
  classifyMemory,
} from 'tsunami-memory';

// Add
const id = await tsunamiAdd('project', 'tasks', 'Completed API refactor', 5);

// Search
const results = await tsunamiSearch('API refactor', 'project', undefined, 10);

// Storm center
const storm = buildTsunamiStormCenter({
  projectDir: './my-project',
  query: 'continue the API work',
});
console.log(formatTsunamiStormCenterText(storm));
```

---

## Automatic Memory

By default, TSUNAMI operations are **explicit** — you call them when you want to store or recall. For hands-free memory, wire TSUNAMI into Claude Code hooks. The HTTP API must be running as a background daemon:

```bash
bun run server/api.ts &   # or use PM2 / launchd
```

### Three Hook Scenarios

**Session-Start** — inject storm center context so Claude wakes up with full situational awareness:

```json
{
  "hooks": {
    "SessionStart": [{
      "matcher": "",
      "hooks": [{
        "type": "command",
        "command": "STORM=$(curl -s 'http://localhost:18904/storm' | python3 -c \"import sys,json; d=json.load(sys.stdin); t=d.get('storm',{}).get('text',''); print(t[:3000])\" 2>/dev/null); if [ -n \"$STORM\" ]; then echo \"$STORM\"; fi"
      }]
    }]
  }
}
```

**Session-End** — auto-diary each session:

```json
{
  "hooks": {
    "Stop": [{
      "matcher": "",
      "hooks": [{
        "type": "command",
        "command": "curl -s -X POST http://localhost:18904/diary -H 'Content-Type: application/json' -d '{\"entry\":\"Session ended\",\"agent\":\"claude\",\"wing\":\"session\",\"importance\":3}' > /dev/null 2>&1"
      }]
    }]
  }
}
```

**Every Turn** — auto-archive decision keywords:

```json
{
  "hooks": {
    "UserPromptSubmit": [{
      "matcher": "",
      "hooks": [{
        "type": "command",
        "command": "PROMPT=$(cat); if echo \"$PROMPT\" | grep -qiE 'decid|chose|finaliz|merge|deploy|releas|shipp'; then curl -s -X POST http://localhost:18904/add -H 'Content-Type: application/json' -d \"{\\\"wing\\\":\\\"decision\\\",\\\"content\\\":\\\"$(echo $PROMPT | tr '\\\"' ' ' | head -c 500)\\\",\\\"energy\\\":4}\" > /dev/null 2>&1; fi"
      }]
    }]
  }
}
```

> See the [Complete Auto-Memory Config](#automatic-memory) section in the full README source for a ready-to-paste `settings.json` combining all three hooks.

---

## Core Concepts

| Concept | Description |
|---------|-------------|
| **Basin & Current** | Memories are organized into basins (topic areas). Each basin has a current (active flow) tracking what you're working on. |
| **Storm Center** | Real-time analysis of active signals — flow direction, storm mode, pressure level, execution gate, budget allocation. |
| **Execution Gate** | Controls agent step budget: `proceed` (full), `guarded` (reduced), `hold` (blocked) — based on memory confidence. |
| **Evidence Linking** | Every memory links to its source — `conversation`, `file:<path>`, `config:<path>`. |
| **Conflict Detection** | Contradictory memories are flagged, confidence is lowered, and repair suggestions are surfaced. |

---

## Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `TSUNAMI_HOME` | `.tsunami` | Storage directory |
| `TSUNAMI_PORT` | `18904` | HTTP API port |
| `TSUNAMI_STORM_THRESHOLD` | `0.7` | Minimum energy for storm signal |
| `TSUNAMI_BUDGET_STEPS` | `99` | Default execution budget |

---

## License

MIT © TSUNAMI Memory System
