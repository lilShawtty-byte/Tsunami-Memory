/**
 * TSUNAMI Memory Classifier — generic keyword-based classification
 *
 * Maps memory content to wings/rooms/basins for automatic routing.
 * All keywords in English. No user-specific data.
 */

type KeywordPair = readonly [string, number];

type StructuredClassification = {
  wing: string;
  room: string;
  basin: string;
  current: string;
  confidence: number;
};

const WING_KEYWORDS: Record<string, KeywordPair[]> = {
  identity: [
    ['identity', 3.0], ['whoami', 3.0], ['name', 2.0], ['role', 3.0],
    ['personality', 3.0], ['character', 2.5], ['behavior', 2.0],
    ['preference', 2.0], ['style', 2.0], ['tone', 2.0],
    ['principle', 3.0], ['rule', 2.5], ['iron_law', 3.5], ['red_line', 3.5],
    ['communication', 2.0], ['speech', 2.0],
  ],
  brain: [
    ['brain', 2.5], ['model', 2.0],
    ['provider', 2.5], ['engine', 2.0],
    ['port', 2.0], ['config', 2.0],
    ['start', 1.5], ['stop', 1.5], ['restart', 1.5], ['shutdown', 1.5],
    ['tool', 2.0], ['loader', 3.0],
    ['register', 2.0], ['executor', 2.5],
    ['tts', 3.0], ['voice', 2.0], ['synthesis', 2.0], ['audio', 1.5],
    ['architecture', 2.0], ['module', 2.0],
    ['directory', 1.5], ['path', 1.5], ['file', 1.0],
    ['code', 1.5], ['implementation', 1.5], ['bug', 2.0], ['fix', 1.5],
  ],
  decision: [
    ['decision', 3.0], ['decision_making', 3.0], ['chose', 2.5],
    ['approach', 2.5], ['tech_selection', 3.0], ['adopted', 2.0],
    ['abandoned', 2.0], ['conclusion', 2.0], ['final_approach', 3.0],
    ['decided', 3.0], ['finalized', 2.5], ['selected', 2.0],
    ['architecture', 2.5], ['tech_stack', 3.0], ['framework', 2.0],
    ['feature', 1.5], ['requirement', 1.5],
  ],
  memory: [
    ['memory', 3.0], ['graphmemory', 3.0], ['knowledge_graph', 3.0],
    ['relationship', 2.0], ['recall', 2.5], ['search', 1.5],
    ['chromadb', 2.5], ['vector', 2.5], ['embedding', 2.5],
    ['semantic_search', 3.0], ['semantic', 2.0],
    ['recollection', 2.0], ['remember', 1.5], ['forget', 1.5], ['archive', 2.0],
    ['session', 2.0], ['context', 1.5],
    ['compress', 2.0],
    ['wrapper', 2.5], ['long_term_memory', 3.0], ['memory_fabric', 2.5], ['tsunami', 2.5],
  ],
  task: [
    ['task', 2.0], ['todo', 2.0], ['project', 1.5],
    ['feature', 1.5], ['implement', 2.0], ['development', 1.5],
    ['bug', 2.0], ['fix', 1.5], ['testing', 1.5],
    ['deploy', 1.5], ['deployment', 1.5], ['done', 1.5],
    ['in_progress', 2.0], ['plan', 1.5],
    ['daily', 2.0], ['routine', 2.0],
    ['core_task', 3.0], ['phase_task', 2.5], ['phase_1', 2.5],
    ['heartbeat_check', 3.0], ['scheduled_check', 2.5], ['verify', 2.5],
    ['check', 1.5],
  ],
  people: [
    ['user', 3.0], ['boss', 3.0],
    ['partner', 3.0],
    ['team', 1.5], ['colleague', 1.5],
  ],
};

const ROOM_KEYWORDS: Record<string, Record<string, KeywordPair[]>> = {
  identity: {
    core: [
      ['identity', 3.0], ['whoami', 3.0], ['name', 2.5], ['role_positioning', 3.0],
      ['core_identity', 3.0], ['deputy', 3.0], ['platform', 1.0],
    ],
    personality: [
      ['personality', 3.0], ['assertive', 3.0],
      ['speech_style', 3.0], ['tone', 2.5], ['communication', 2.0],
      ['elite', 2.0], ['professional', 2.0],
    ],
    rules: [
      ['rule', 3.0], ['principle', 3.0], ['hard_line', 3.0],
      ['red_line', 3.0], ['iron_law', 3.0], ['ban', 3.0],
    ],
  },
  brain: {
    model: [['brain', 3.0], ['model', 2.5], ['provider', 2.5], ['engine', 2.5], ['intent', 2.0]],
    tts: [['tts', 3.0], ['voice', 3.0], ['synthesis', 3.0], ['audio', 2.0], ['read_aloud', 2.0]],
    tools: [['tool', 3.0], ['register', 2.5]],
    architecture: [['architecture', 3.0], ['module', 2.5], ['design', 2.0], ['structure', 2.0], ['directory', 2.0], ['path', 1.5], ['file', 1.5], ['backend', 2.5], ['execution_loop', 2.5], ['context', 1.5]],
    config: [['config', 3.0], ['port', 2.5], ['setting', 2.0]],
    control: [['control_plane', 2.5], ['restart', 1.5]],
  },
  decision: {
    strategy: [['tech_selection', 3.0], ['approach', 2.5], ['architecture', 2.5], ['tech_stack', 3.0], ['framework', 2.0], ['language', 2.0]],
    product: [['product', 3.0], ['direction', 2.5], ['feature', 2.5], ['requirement', 2.5]],
    direction: [['strategy', 3.0], ['direction', 2.5], ['priority', 2.5]],
  },
  memory: {
    tsunami: [['compress', 2.5], ['embedding', 2.0], ['integration', 2.0], ['long_term_memory', 3.0], ['memory_fabric', 2.5], ['tsunami', 2.5]],
    graph: [['graphmemory', 3.0], ['knowledge_graph', 3.0], ['relationship', 2.0], ['timeline', 2.5]],
    context: [['context', 2.5], ['history', 2.0], ['message', 1.5]],
  },
  task: {
    project: [['project', 3.0], ['feature', 2.5], ['implement', 2.5], ['development', 2.0], ['phase', 2.5], ['integration', 1.5], ['task', 1.5], ['core_task', 3.0], ['phase_task', 2.5], ['phase_1', 3.0]],
    routine: [['daily', 3.0], ['routine', 3.0], ['scheduled', 2.5], ['heartbeat', 3.0], ['verify', 2.0], ['check', 1.5], ['heartbeat_check', 3.5], ['scheduled_check', 3.0]],
  },
  people: {
    user: [['user', 3.0], ['boss', 3.0]],
    partner: [['partner', 3.0]],
    team: [['team', 2.0], ['colleague', 2.0]],
  },
};

export function classifyMemory(text: string): StructuredClassification | null {
  const lower = text.toLowerCase();
  const scores: Record<string, number> = {};

  for (const [wing, keywords] of Object.entries(WING_KEYWORDS)) {
    for (const [keyword, weight] of keywords) {
      if (lower.includes(keyword.toLowerCase())) {
        scores[wing] = (scores[wing] || 0) + weight;
      }
    }
  }

  let bestWing = '';
  let bestScore = 0;
  for (const [wing, score] of Object.entries(scores)) {
    if (score > bestScore) { bestWing = wing; bestScore = score; }
  }

  if (!bestWing || bestScore < 2.0) return null;

  const rooms = ROOM_KEYWORDS[bestWing];
  let bestRoom = 'general';
  let bestRoomScore = 0;
  if (rooms) {
    for (const [room, keywords] of Object.entries(rooms)) {
      let rs = 0;
      for (const [keyword, weight] of keywords) {
        if (lower.includes(keyword.toLowerCase())) rs += weight;
      }
      if (rs > bestRoomScore) { bestRoom = room; bestRoomScore = rs; }
    }
  }

  return {
    wing: bestWing,
    room: bestRoom,
    basin: bestWing,
    current: bestRoom,
    confidence: Math.min(1.0, bestScore / 10),
  };
}

/**
 * classifyTsunamiText — returns basin/current/confidence for a text string.
 * Wraps classifyMemory to return the simpler storm center API shape.
 */
export function classifyTsunamiText(text: string): {
  basin: string;
  current: string;
  confidence: number;
} {
  const result = classifyMemory(text);
  if (!result) {
    return { basin: 'surface', current: 'surface/bridge', confidence: 0.2 };
  }
  return {
    basin: result.basin,
    current: result.current,
    confidence: result.confidence,
  };
}

/**
 * classifyTsunamiTextMulti — returns top N classifications with basin/current/confidence.
 */
export function classifyTsunamiTextMulti(
  text: string,
  top = 3,
): Array<{ basin: string; current: string; confidence: number }> {
  const lower = text.toLowerCase();

  const wingScores: Array<{ wing: string; score: number }> = [];
  for (const [wing, keywords] of Object.entries(WING_KEYWORDS)) {
    let score = 0;
    for (const [keyword, weight] of keywords) {
      if (lower.includes(keyword.toLowerCase())) score += weight;
    }
    if (score > 0) {
      wingScores.push({ wing, score });
    }
  }

  wingScores.sort((a, b) => b.score - a.score);
  const limit = Math.max(1, top);

  return wingScores.slice(0, limit).map((entry) => {
    // Find the best room within this wing, mirroring classifyMemory logic
    const rooms = ROOM_KEYWORDS[entry.wing];
    let bestRoom = entry.wing; // fallback: wing name as current
    let bestRoomScore = 0;
    if (rooms) {
      for (const [room, keywords] of Object.entries(rooms)) {
        let rs = 0;
        for (const [keyword, weight] of keywords) {
          if (lower.includes(keyword.toLowerCase())) rs += weight;
        }
        if (rs > bestRoomScore) { bestRoom = room; bestRoomScore = rs; }
      }
    }
    // If no room keywords matched, bestRoom stays as wing name
    const current = bestRoomScore > 0 ? bestRoom : entry.wing;

    return {
      basin: entry.wing,
      current,
      confidence: Math.min(1.0, entry.score / 10),
    };
  });
}
