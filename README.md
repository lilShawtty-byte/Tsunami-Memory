# TSUNAMI — Oceanic Memory System

Bun-native memory runtime with basin/current flow, storm center, hot+cold retrieval, knowledge graph sync, and evidence linking.

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

## Installation

```bash
bun install
```

**Requirements:** Bun >= 1.0.0 (SQLite is built into Bun, zero external runtime dependencies)

## Quick Start

### 1. Install & start the server

```bash
cd TSUNAMI
bun install
bun run server/api.ts
# → 🌊 TSUNAMI Memory API running on http://localhost:18904
```

### 2. Add memories via HTTP

```bash
curl -X POST http://localhost:18904/add \
  -H 'Content-Type: application/json' \
  -d '{"wing":"project","room":"tasks","content":"Completed API refactor for auth module","energy":5}'
# → {"ok":true,"result":"bunmem_abc123..."}
```

### 3. Search with FTS5 full-text

```bash
curl 'http://localhost:18904/search?q=API+refactor&limit=5'
# → {"ok":true,"query":"API refactor","result":"..."}
```

### 4. Check storm center

```bash
curl 'http://localhost:18904/storm?query=continue+work'
# → {"ok":true,"storm":{"flow":{"basin":"surface","current":"surface/bridge"},"stormMode":{...}}}
```

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

Then use tools in any MCP-compatible client:

| Tool | When to use | Example args |
|------|-------------|-------------|
| `tsunami_add` | Store a fact, decision, or observation | `{content:"Decided to use Redis for caching", wing:"decision", energy:4}` |
| `tsunami_search` | Find memories by keyword | `{query:"Redis cache", limit:5}` |
| `tsunami_recall` | Pull recent memories from a topic | `{wing:"project", limit:10}` |
| `tsunami_storm` | Get current context before starting work | `{query:"continue the API work"}` |
| `tsunami_status` | Check memory store health | `{}` |
| `tsunami_timeline` | See chronological memory feed | `{limit:20}` |
| `tsunami_diary` | Log a session or daily entry | `{entry:"Today I built...", agent:"claude"}` |
| `tsunami_wings` | List all topic areas and counts | `{}` |

### Interface B: HTTP API (any language)

Start the server:

```bash
TSUNAMI_PORT=18904 TSUNAMI_HOME=~/.tsunami bun run server/api.ts
```

All endpoints return JSON. Parameter validation is enforced at the boundary — missing required fields return HTTP 400 with an error message.

| Method | Path | Body / Query | Use for |
|--------|------|-------------|---------|
| POST | `/add` | `{wing, room, content, energy}` | Store a memory |
| GET | `/search` | `?q=&wing=&limit=` | FTS5 full-text search |
| GET | `/recall` | `?wing=&room=&limit=` | Recent memories from a topic |
| GET | `/storm` | `?project=&query=` | Storm center analysis |
| GET | `/status` | — | System health and counts |
| GET | `/timeline` | `?limit=` | Chronological memory feed |
| POST | `/diary` | `{entry, agent, wing}` | Session/daily log |
| GET | `/health` | — | Liveness check |
| GET | `/` | — | Service discovery |

**Add parameters:**

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `wing` | string | `"general"` | Topic basin (project, feedback, reference, user, etc.) |
| `room` | string | `"inbox"` | Sub-topic within the wing |
| `content` | string | **(required)** | The memory text. Supports Chinese, emoji, any Unicode |
| `energy` | number `1-5` | `3` | Importance level. 5 = critical, 1 = footnote |

**Code examples:**

```bash
# Shell
curl -X POST http://localhost:18904/add -H 'Content-Type: application/json' \
  -d '{"wing":"project","room":"tasks","content":"Refactored auth module","energy":4}'
curl 'http://localhost:18904/search?q=auth+refactor&limit=5'
curl 'http://localhost:18904/recall?wing=project&limit=3'
```

```python
import requests
# Add
r = requests.post('http://localhost:18904/add', json={
    'wing': 'feedback', 'room': 'corrections',
    'content': 'User prefers dark mode by default', 'energy': 5
})
# Search
r = requests.get('http://localhost:18904/search', params={'q': 'dark mode', 'limit': 3})
# Storm
r = requests.get('http://localhost:18904/storm', params={'query': 'continue feature work'})
```

```typescript
// TypeScript / JavaScript
const r = await fetch('http://localhost:18904/add', {
  method: 'POST',
  headers: {'Content-Type': 'application/json'},
  body: JSON.stringify({wing: 'reference', room: 'docs', content: 'Bun sqlite API docs', energy: 3})
});
const { result } = await r.json();
```

### Interface C: TypeScript SDK (programmatic)

Import TSUNAMI functions directly in any Bun/TypeScript project:

```typescript
import {
  tsunamiAdd,       // Add a memory → returns bunmem_xxx id
  tsunamiSearch,    // FTS5 full-text search
  tsunamiRecall,    // Recall by wing/room
  tsunamiWakeUp,    // Context summary for session start
  tsunamiDiary,     // Write dated diary entry
  tsunamiStatus,    // System health and stats
  tsunamiTimeline,  // Chronological feed
  tsunamiListWings, // Wing/room taxonomy
  // Knowledge graph
  tsunamiKgAdd,
  tsunamiKgQuery,
  tsunamiKgStats,
  tsunamiKgTimeline,
  // Storm center
  buildTsunamiStormCenter,
  formatTsunamiStormCenterText,
  // Execution gate
  buildTsunamiExecutionGate,
  applyTsunamiExecutionGateToTool,
  // Classification
  classifyMemory,
} from 'tsunami-memory';

// Add a memory
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

## Manual vs Automatic

By default, all TSUNAMI operations are **explicit** — you call `tsunami_add` or hit the HTTP endpoint when you want to store something. For hands-free memory, wire TSUNAMI into Claude Code hooks (see below).

## Automatic Memory Setup

The HTTP API must be running for hooks to work. Start it as a background daemon:

```bash
bun run /path/to/TSUNAMI/server/api.ts &
```

Or use PM2 / launchd to keep it alive across reboots.

### Session-Start: Auto-Recall Context

On each new session, inject the storm center summary so Claude wakes up with full context:

```json
{
  "hooks": {
    "SessionStart": [
      {
        "matcher": "",
        "hooks": [
          {
            "type": "command",
            "command": "STORM=$(curl -s 'http://localhost:18904/storm?query=continue+current+work' | python3 -c \"import sys,json; d=json.load(sys.stdin); print(d.get('storm',{}).get('text','')[:2000])\" 2>/dev/null); if [ -n \"$STORM\" ]; then echo \"$STORM\"; fi"
          }
        ]
      }
    ]
  }
}
```

### Session-End: Auto-Diary

On each session end, save a diary entry with the session summary:

```json
{
  "hooks": {
    "Stop": [
      {
        "matcher": "",
        "hooks": [
          {
            "type": "command",
            "command": "curl -s -X POST http://localhost:18904/diary -H 'Content-Type: application/json' -d \"{\\\"entry\\\":\\\"Session completed: $(date -u +%Y-%m-%dT%H:%M:%SZ)\\\",\\\"agent\\\":\\\"claude\\\",\\\"wing\\\":\\\"session\\\"}\" > /dev/null 2>&1"
          }
        ]
      }
    ]
  }
}
```

### Every Turn: Auto-Archive Important Decisions

Use `UserPromptSubmit` to check for decision keywords and auto-archive:

```json
{
  "hooks": {
    "UserPromptSubmit": [
      {
        "matcher": "",
        "hooks": [
          {
            "type": "command",
            "command": "PROMPT=$(cat); if echo \"$PROMPT\" | grep -qiE 'decided|chose|finalized|merge|deploy|release'; then curl -s -X POST http://localhost:18904/diary -H 'Content-Type: application/json' -d \"{\\\"entry\\\":\\\"Decision trigger: $(echo $PROMPT | head -c 200)\\\",\\\"agent\\\":\\\"auto\\\",\\\"wing\\\":\\\"decision\\\"}\" > /dev/null 2>&1; fi"
          }
        ]
      }
    ]
  }
}
```

### Complete Auto-Memory Config

Copy this block into `~/.claude/settings.json` to enable all three hooks at once. The HTTP API server must be running on port 18904.

```json
{
  "hooks": {
    "SessionStart": [
      {
        "matcher": "",
        "description": "TSUNAMI: inject storm center context on session start",
        "hooks": [
          {
            "type": "command",
            "command": "STORM=$(curl -s 'http://localhost:18904/storm' | python3 -c \"import sys,json; d=json.load(sys.stdin); t=d.get('storm',{}).get('text',''); print(t[:3000])\" 2>/dev/null); if [ -n \"$STORM\" ]; then echo \"$STORM\"; fi"
          }
        ]
      }
    ],
    "Stop": [
      {
        "matcher": "",
        "description": "TSUNAMI: auto-diary on session end",
        "hooks": [
          {
            "type": "command",
            "command": "curl -s -X POST http://localhost:18904/diary -H 'Content-Type: application/json' -d \"{\\\"entry\\\":\\\"Session ended $(date -u +%Y-%m-%dT%H:%M:%SZ)\\\",\\\"agent\\\":\\\"claude\\\",\\\"wing\\\":\\\"session\\\",\\\"importance\\\":3}\" > /dev/null 2>&1"
          }
        ]
      }
    ],
    "UserPromptSubmit": [
      {
        "matcher": "",
        "description": "TSUNAMI: archive decisions on keyword match",
        "hooks": [
          {
            "type": "command",
            "command": "PROMPT=$(cat); if echo \"$PROMPT\" | grep -qiE 'decid|chose|finaliz|merge|deploy|releas|shipp'; then curl -s -X POST http://localhost:18904/add -H 'Content-Type: application/json' -d \"{\\\"wing\\\":\\\"decision\\\",\\\"room\\\":\\\"auto\\\",\\\"content\\\":\\\"$(echo $PROMPT | tr '\\\"' ' ' | head -c 500)\\\",\\\"energy\\\":4}\" > /dev/null 2>&1; fi"
          }
        ]
      }
    ]
  }
}
```

## Core Concepts

### Basin & Current Flow

Memories are organized into **basins** (topic areas). Each basin has a **current** (active flow) tracking what you're working on. The flow shifts as context changes.

### Storm Center

Focused view of active signals: flow direction, storm mode, pressure level, execution gate, budget allocation.

### Execution Gate

Controls agent step budget based on memory confidence:
- `proceed` / `open` — full budget (high confidence)
- `guarded` / `guided` — reduced budget (uncertain)
- `hold` / `frozen` — blocked (no data)

### Evidence Linking

Every memory links to its source: `conversation`, `file:<path>`, `config:<path>`.

### Conflict Detection

When new memories contradict existing evidence, conflicts are flagged and confidence lowered.

## Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `TSUNAMI_HOME` | `.tsunami` | Storage directory |
| `TSUNAMI_PORT` | `18904` | HTTP API port |
| `TSUNAMI_STORM_THRESHOLD` | `0.7` | Minimum energy for storm signal |
| `TSUNAMI_BUDGET_STEPS` | `99` | Default execution budget |

## License

MIT
