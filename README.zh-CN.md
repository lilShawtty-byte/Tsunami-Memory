<p align="center">
  <img src="https://img.shields.io/badge/状态-活跃-2ea44f?style=for-the-badge" alt="状态">
  <img src="https://img.shields.io/badge/Bun-%3E%3D1.0.0-fbf0df?style=for-the-badge&logo=bun&logoColor=000" alt="Bun">
  <img src="https://img.shields.io/badge/协议-MIT-yellow?style=for-the-badge" alt="协议">
  <img src="https://img.shields.io/badge/依赖-零-blue?style=for-the-badge" alt="依赖">
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

<p align="center"><strong>面向 AI Agent 的海洋记忆系统</strong></p>

<p align="center">Bun 原生运行时 — SQLite FTS5 全文检索 · 知识图谱 · 风暴中心分析 · MCP / HTTP / SDK</p>

---

## 目录

- [架构设计](#架构设计)
- [安装](#安装)
- [快速上手](#快速上手)
- [使用指南](#使用指南)
  - [接口 A：MCP 工具](#接口-amcp-工具适用于-claude-code--cursor--windsurf)
  - [接口 B：HTTP API](#接口-bhttp-api适用于任何语言)
  - [接口 C：TypeScript SDK](#接口-ctypescript-sdk编程式调用)
- [自动记忆](#自动记忆)
- [核心概念](#核心概念)
- [环境变量](#环境变量)
- [协议](#协议)

---

## 架构设计

```
TSUNAMI 记忆模型
├── 盆地 — 按主题区域组织记忆
│   ├── project   — 工作上下文
│   ├── feedback  — 修正与偏好
│   ├── reference — 外部系统知识
│   └── user      — 用户画像与身份
│
├── 洋流 — 盆地内的活跃焦点
│   └── 追踪当前正在处理的主题
│
├── 风暴中心 — 活跃信号的聚焦视图
│   ├── 带能量级别的活跃信号
│   ├── 带置信度评分的近期证据
│   ├── 风暴模式检测（主导类型 + 压力等级）
│   └── 执行门控（按任务分配预算）
│
├── 热 + 冷检索
│   ├── 热：SQLite FTS5 全文搜索（亚毫秒级）
│   └── 冷：知识图谱遍历（语义检索）
│
└── 运行时图谱同步
    ├── 跨会话自动同步记忆
    └── 冲突检测 + 证据链接
```

---

## 安装

```bash
bun install
```

> **运行要求：** Bun >= 1.0.0。SQLite 内置于 Bun 运行时 —— **零外部运行时依赖**。

---

## 快速上手

### 1. 启动服务

```bash
bun run server/api.ts
# → 🌊 TSUNAMI Memory API 已启动 → http://localhost:18904
```

### 2. 添加记忆

```bash
curl -X POST http://localhost:18904/add \
  -H 'Content-Type: application/json' \
  -d '{"wing":"project","room":"tasks","content":"完成了认证模块的 API 重构","energy":5}'
# → {"ok":true,"result":"bunmem_abc123..."}
```

### 3. 全文搜索

```bash
curl 'http://localhost:18904/search?q=认证+重构&limit=5'
```

### 4. 查看风暴中心

```bash
curl 'http://localhost:18904/storm?query=继续工作'
# → {"ok":true,"storm":{"flow":{"basin":"surface",...},"stormMode":{...}}}
```

---

## 使用指南

TSUNAMI 提供三种接口，按你的技术栈选择。

### 接口 A：MCP 工具（适用于 Claude Code / Cursor / Windsurf）

在 `~/.claude/mcp.json` 中配置一次即可：

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

任何 MCP 兼容客户端中可使用以下八个工具：

| 工具 | 使用场景 | 示例参数 |
|------|---------|---------|
| `tsunami_add` | 存储事实、决策或观察 | `{content:"决定用 Redis 做缓存", wing:"decision", energy:4}` |
| `tsunami_search` | 按关键词查找记忆 | `{query:"Redis 缓存", limit:5}` |
| `tsunami_recall` | 拉取某个主题的近期记忆 | `{wing:"project", limit:10}` |
| `tsunami_storm` | 开始工作前获取当前上下文 | `{query:"继续 API 开发"}` |
| `tsunami_status` | 检查记忆库健康状态 | `{}` |
| `tsunami_timeline` | 查看按时间排列的记忆流 | `{limit:20}` |
| `tsunami_diary` | 记录一次会话或每日日志 | `{entry:"今天我构建了...", agent:"claude"}` |
| `tsunami_wings` | 列出所有主题区域及数量 | `{}` |

> **提示：** MCP 服务会在 Claude Code 启动时自动运行，无需单独管理进程。

### 接口 B：HTTP API（适用于任何语言）

```bash
TSUNAMI_PORT=18904 TSUNAMI_HOME=~/.tsunami bun run server/api.ts
```

所有端点返回 JSON。缺少必填字段时返回 HTTP 400。

| 方法 | 路径 | 参数 |
|--------|------|-------------|
| `POST` | `/add` | `{wing, room, content, energy}` |
| `GET` | `/search` | `?q=&wing=&limit=` |
| `GET` | `/recall` | `?wing=&room=&limit=` |
| `GET` | `/storm` | `?project=&query=` |
| `GET` | `/status` | — |
| `GET` | `/timeline` | `?limit=` |
| `POST` | `/diary` | `{entry, agent, wing}` |
| `GET` | `/health` | — |

**add 参数说明：**

| 参数 | 类型 | 默认值 | 说明 |
|-------|------|---------|-------------|
| `wing` | 字符串 | `"general"` | 主题盆地 |
| `room` | 字符串 | `"inbox"` | 盆地内的子主题 |
| `content` | 字符串 | **（必填）** | 记忆文本。支持中文、emoji、任意 Unicode 字符 |
| `energy` | 数字 `1–5` | `3` | 重要程度。5 = 关键，1 = 脚注 |

<table>
<tr><td width="33%">

**Shell**

```bash
curl -X POST localhost:18904/add \
  -H 'Content-Type: application/json' \
  -d '{"wing":"project",
       "content":"重构了认证模块",
       "energy":4}'
curl 'localhost:18904/search?q=认证&limit=5'
```

</td><td width="33%">

**Python**

```python
import requests
r = requests.post(
  'http://localhost:18904/add',
  json={'wing': 'feedback',
        'content': '用户偏好默认深色模式',
        'energy': 5}
)
r = requests.get(
  'http://localhost:18904/search',
  params={'q': '深色模式', 'limit': 3}
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
    content: 'Bun sqlite API 文档',
    energy: 3})
});
const { result } = await r.json();
```

</td></tr>
</table>

### 接口 C：TypeScript SDK（编程式调用）

在任何 Bun/TypeScript 项目中直接导入：

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

// 添加记忆
const id = await tsunamiAdd('project', 'tasks', '完成认证模块重构', 5);

// 搜索
const results = await tsunamiSearch('认证重构', 'project', undefined, 10);

// 风暴中心
const storm = buildTsunamiStormCenter({
  projectDir: './my-project',
  query: '继续 API 开发工作',
});
console.log(formatTsunamiStormCenterText(storm));
```

---

## 自动记忆

默认情况下，TSUNAMI 的所有操作都是**显式调用**的 — 你决定何时存储或回忆。要实现免手动记忆，可以通过 Claude Code hooks 将 TSUNAMI 接入生命周期。HTTP API 需要以守护进程方式运行：

```bash
bun run server/api.ts &   # 或使用 PM2 / launchd
```

### 三种 Hook 场景

**会话启动** — 注入风暴中心上下文，让 AI 在会话开始时掌握完整情境：

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

**会话结束** — 自动记录会话日记：

```json
{
  "hooks": {
    "Stop": [{
      "matcher": "",
      "hooks": [{
        "type": "command",
        "command": "curl -s -X POST http://localhost:18904/diary -H 'Content-Type: application/json' -d '{\"entry\":\"会话结束\",\"agent\":\"claude\",\"wing\":\"session\",\"importance\":3}' > /dev/null 2>&1"
      }]
    }]
  }
}
```

**每次输入** — 检测到决策关键词时自动归档：

```json
{
  "hooks": {
    "UserPromptSubmit": [{
      "matcher": "",
      "hooks": [{
        "type": "command",
        "command": "PROMPT=$(cat); if echo \"$PROMPT\" | grep -qiE 'decid|chose|finaliz|merge|deploy|releas|shipp|决定|选择|确定|合并|部署|发布|上线'; then curl -s -X POST http://localhost:18904/add -H 'Content-Type: application/json' -d \"{\\\"wing\\\":\\\"decision\\\",\\\"content\\\":\\\"$(echo $PROMPT | tr '\\\"' ' ' | head -c 500)\\\",\\\"energy\\\":4}\" > /dev/null 2>&1; fi"
      }]
    }]
  }
}
```

> 完整的三合一配置可直接在英文 README 的 [Complete Auto-Memory Config](#automatic-memory) 节找到。

---

## 核心概念

| 概念 | 说明 |
|---------|-------------|
| **盆地与洋流** | 记忆按盆地（主题区域）组织。每个盆地有一条洋流（活跃焦点），追踪当前工作内容。焦点随上下文变化而流动。 |
| **风暴中心** | 实时分析活跃信号 — 流向、风暴模式、压力等级、执行门控、预算分配。 |
| **执行门控** | 根据记忆置信度控制 Agent 行动预算：`proceed`（全速前进）、`guarded`（谨慎推进）、`hold`（暂停等待）。 |
| **证据链接** | 每条记忆都链接到其来源 — `conversation`、`file:<path>`、`config:<path>`。 |
| **冲突检测** | 当新记忆与已有证据矛盾时，标记冲突、降低置信度，并给出修复建议。 |

---

## 环境变量

| 变量 | 默认值 | 说明 |
|----------|---------|-------------|
| `TSUNAMI_HOME` | `.tsunami` | 数据存储目录 |
| `TSUNAMI_PORT` | `18904` | HTTP API 端口 |
| `TSUNAMI_STORM_THRESHOLD` | `0.7` | 风暴信号的最低能量阈值 |
| `TSUNAMI_BUDGET_STEPS` | `99` | 默认执行预算步数 |

---

## 协议

MIT © TSUNAMI Memory System
