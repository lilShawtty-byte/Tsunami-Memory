/**
 * TSUNAMI legacy taxonomy mapping
 *
 * Maps legacy wing/room identifiers to the current basin/current taxonomy.
 *
 * Legacy wings are mapped as follows:
 *   ats      -> epicenter  (core identity, memory operations)
 *   brain    -> surface    (model, tools, architecture)
 *   decision -> faultline  (choices, direction, strategy)
 *   memory   -> abyss      (deep storage, retrieval, compression)
 *   task     -> surge      (execution, projects, routines)
 *   people   -> harbor     (users, partners, team)
 */

export const TSUNAMI_LEGACY_TAXONOMY_ENTRIES = [
  // --- epicenter (legacy: ats) ---
  {
    legacyWing: 'ats',
    legacyRoom: 'ats/signature',
    basin: 'epicenter',
    current: 'epicenter/signature',
    description: 'Core identity signature and positioning',
  },
  {
    legacyWing: 'ats',
    legacyRoom: 'ats/crest',
    basin: 'epicenter',
    current: 'epicenter/crest',
    description: 'Peak identity states and high-confidence role affirmations',
  },
  {
    legacyWing: 'ats',
    legacyRoom: 'ats/law',
    basin: 'epicenter',
    current: 'epicenter/law',
    description: 'Immutable rules, principles, and hard boundaries',
  },
  // --- surface (legacy: brain) ---
  {
    legacyWing: 'brain',
    legacyRoom: 'brain/bridge',
    basin: 'surface',
    current: 'surface/bridge',
    description: 'Model provider bridge and engine configuration',
  },
  {
    legacyWing: 'brain',
    legacyRoom: 'brain/helm',
    basin: 'surface',
    current: 'surface/helm',
    description: 'Active control plane, execution loop, and orchestration',
  },
  {
    legacyWing: 'brain',
    legacyRoom: 'brain/rigging',
    basin: 'surface',
    current: 'surface/rigging',
    description: 'Tool rigging, registration, and executor wiring',
  },
  {
    legacyWing: 'brain',
    legacyRoom: 'brain/hull',
    basin: 'surface',
    current: 'surface/hull',
    description: 'Architecture, modules, and structural integrity',
  },
  {
    legacyWing: 'brain',
    legacyRoom: 'brain/chart',
    basin: 'surface',
    current: 'surface/chart',
    description: 'Directory layout, paths, and project navigation',
  },
  {
    legacyWing: 'brain',
    legacyRoom: 'brain/echo',
    basin: 'surface',
    current: 'surface/echo',
    description: 'TTS, voice, audio, and speech synthesis',
  },
  // --- faultline (legacy: decision) ---
  {
    legacyWing: 'decision',
    legacyRoom: 'decision/choice',
    basin: 'faultline',
    current: 'faultline/choice',
    description: 'Technical decisions, architecture selection, and approach finalization',
  },
  {
    legacyWing: 'decision',
    legacyRoom: 'decision/course',
    basin: 'faultline',
    current: 'faultline/course',
    description: 'Strategic direction, priorities, and product decisions',
  },
  {
    legacyWing: 'decision',
    legacyRoom: 'decision/drift',
    basin: 'faultline',
    current: 'faultline/drift',
    description: 'Conflicts, abandoned approaches, and course corrections',
  },
  // --- abyss (legacy: memory) ---
  {
    legacyWing: 'memory',
    legacyRoom: 'memory/archive',
    basin: 'abyss',
    current: 'abyss/archive',
    description: 'Long-term memory storage, compression, and archival',
  },
  {
    legacyWing: 'memory',
    legacyRoom: 'memory/mesh',
    basin: 'abyss',
    current: 'abyss/mesh',
    description: 'Knowledge graph, relationships, and semantic connections',
  },
  {
    legacyWing: 'memory',
    legacyRoom: 'memory/wake',
    basin: 'abyss',
    current: 'abyss/wake',
    description: 'Memory retrieval, wake signals, and activation patterns',
  },
  {
    legacyWing: 'memory',
    legacyRoom: 'memory/anchors',
    basin: 'abyss',
    current: 'abyss/anchors',
    description: 'Recovery anchors, checkpoints, and persistent reference points',
  },
  {
    legacyWing: 'memory',
    legacyRoom: 'memory/evidence',
    basin: 'abyss',
    current: 'abyss/evidence',
    description: 'Evidence snippets, citations, and supporting context',
  },
  // --- surge (legacy: task) ---
  {
    legacyWing: 'task',
    legacyRoom: 'task/expedition',
    basin: 'surge',
    current: 'surge/expedition',
    description: 'Active projects, features, and implementation work',
  },
  {
    legacyWing: 'task',
    legacyRoom: 'task/tide',
    basin: 'surge',
    current: 'surge/tide',
    description: 'Scheduled routines, daily tasks, and recurring checks',
  },
  {
    legacyWing: 'task',
    legacyRoom: 'task/queue',
    basin: 'surge',
    current: 'surge/queue',
    description: 'Task backlog, pending items, and work queue',
  },
  {
    legacyWing: 'task',
    legacyRoom: 'task/blockers',
    basin: 'surge',
    current: 'surge/blockers',
    description: 'Blockers, issues, and impediments to progress',
  },
  // --- harbor (legacy: people) ---
  {
    legacyWing: 'people',
    legacyRoom: 'people/crew',
    basin: 'harbor',
    current: 'harbor/crew',
    description: 'Users, team members, and collaboration context',
  },
  {
    legacyWing: 'people',
    legacyRoom: 'people/research',
    basin: 'harbor',
    current: 'harbor/research',
    description: 'Research findings, explorations, and investigations',
  },
  {
    legacyWing: 'people',
    legacyRoom: 'people/liu-lie',
    basin: 'harbor',
    current: 'harbor/liu-lie',
    description: 'Partner context and shared understanding',
  },
  {
    legacyWing: 'people',
    legacyRoom: 'people/dandan',
    basin: 'harbor',
    current: 'harbor/dandan',
    description: 'Companion and adjacent agent context',
  },
];
