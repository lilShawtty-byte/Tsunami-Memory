/**
 * TSUNAMI Classifier Keywords — wing/room keyword data
 *
 * Extracted from classifier logic for maintainability.
 * Each keyword maps to a weight in the range [1.0, 4.0]:
 *   1.0–1.5  — weak signal (common words, low specificity)
 *   2.0–2.5  — moderate signal
 *   3.0–3.5  — strong signal (domain-specific terms)
 *   4.0       — definitive signal (reserved for exact-match terms)
 */

export type KeywordPair = readonly [string, number];

/** Wing-level keywords — determines which basin a memory belongs to. */
export const WING_KEYWORDS: Record<string, KeywordPair[]> = {
  identity: [
    ['identity', 3.0], ['whoami', 3.0], ['name', 2.0], ['role', 3.0],
    ['personality', 3.0], ['character', 2.5], ['behavior', 2.0],
    ['preference', 2.0], ['style', 2.0], ['tone', 2.0],
    ['principle', 3.0], ['rule', 2.5], ['iron_law', 3.5], ['red_line', 3.5],
    ['communication', 2.0], ['speech', 2.0],
    ['身份', 3.0], ['我是谁', 3.0], ['角色', 3.0], ['名字', 2.0],
    ['人格', 3.0], ['性格', 2.5], ['行为', 2.0], ['偏好', 2.0],
    ['风格', 2.0], ['语气', 2.0], ['原则', 3.0], ['规则', 2.5],
    ['铁律', 3.5], ['红线', 3.5], ['沟通', 2.0],
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
    ['大脑', 2.5], ['模型', 2.0], ['引擎', 2.0],
    ['配置', 2.0], ['工具', 2.0],
    ['架构', 2.0], ['模块', 2.0], ['目录', 1.5],
    ['路径', 1.5], ['文件', 1.0], ['代码', 1.5], ['实现', 1.5],
    ['bug', 2.0], ['修复', 1.5],
  ],
  decision: [
    ['decision', 3.0], ['decision_making', 3.0], ['chose', 2.5],
    ['approach', 2.5], ['tech_selection', 3.0], ['adopted', 2.0],
    ['abandoned', 2.0], ['conclusion', 2.0], ['final_approach', 3.0],
    ['decided', 3.0], ['finalized', 2.5], ['selected', 2.0],
    ['architecture', 2.5], ['tech_stack', 3.0], ['framework', 2.0],
    ['feature', 1.5], ['requirement', 1.5],
    ['决定', 3.0], ['选择', 2.5], ['方案', 2.5],
    ['采用', 2.0], ['放弃', 2.0], ['结论', 2.0],
    ['确定', 3.0], ['技术栈', 3.0], ['框架', 2.0],
    ['功能', 1.5], ['需求', 1.5],
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
    ['记忆', 3.0], ['知识图谱', 3.0], ['关系', 2.0], ['回想', 2.5],
    ['搜索', 1.5], ['向量', 2.5], ['嵌入', 2.5], ['语义搜索', 3.0],
    ['语义', 2.0], ['回忆', 2.0], ['归档', 2.0],
    ['会话', 2.0], ['上下文', 1.5], ['压缩', 2.0],
    ['长期记忆', 3.0],
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
    ['任务', 2.0], ['待办', 2.0], ['项目', 1.5], ['实现', 2.0],
    ['开发', 1.5], ['测试', 1.5], ['部署', 1.5],
    ['完成', 1.5], ['进行中', 2.0], ['计划', 1.5], ['日常', 2.0],
    ['核心任务', 3.0], ['阶段任务', 2.5], ['心跳检查', 3.0], ['验证', 2.5],
  ],
  people: [
    ['user', 3.0], ['boss', 3.0],
    ['partner', 3.0],
    ['team', 1.5], ['colleague', 1.5],
    ['用户', 3.0], ['老板', 3.0], ['伙伴', 3.0], ['团队', 1.5], ['同事', 1.5],
  ],
};

/** Room-level keywords — refines the current within a wing. */
export const ROOM_KEYWORDS: Record<string, Record<string, KeywordPair[]>> = {
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
