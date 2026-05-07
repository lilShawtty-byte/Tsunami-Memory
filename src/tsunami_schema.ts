import {
  TSUNAMI_DEFAULT_LEGACY_ROOM,
  normalizeTsunamiCompatRoom,
} from './legacy_compat/tsunami_compat';
import { TSUNAMI_LEGACY_TAXONOMY_ENTRIES } from './legacy_compat/tsunami_legacy_taxonomy';

export type TsunamiBasin = 'epicenter' | 'surface' | 'faultline' | 'abyss' | 'surge' | 'harbor';
export type TsunamiEntityType =
  | 'agent'
  | 'person'
  | 'project'
  | 'task_thread'
  | 'handoff'
  | 'recovery_anchor'
  | 'checkpoint'
  | 'recovery_record'
  | 'memory_issue'
  | 'repair_suggestion'
  | 'wiki_page'
  | 'evidence_snippet'
  | 'memory_fragment'
  | 'basin'
  | 'current'
  | 'decision'
  | 'session_state'
  | 'feature'
  | 'unknown';

export type TsunamiCurrent =
  | 'epicenter/signature'
  | 'epicenter/crest'
  | 'epicenter/law'
  | 'surface/bridge'
  | 'surface/helm'
  | 'surface/rigging'
  | 'surface/hull'
  | 'surface/chart'
  | 'surface/echo'
  | 'faultline/choice'
  | 'faultline/course'
  | 'faultline/drift'
  | 'abyss/archive'
  | 'abyss/mesh'
  | 'abyss/wake'
  | 'abyss/anchors'
  | 'abyss/evidence'
  | 'surge/expedition'
  | 'surge/tide'
  | 'surge/queue'
  | 'surge/blockers'
  | 'harbor/crew'
  | 'harbor/research'
  | 'harbor/liu-lie'
  | 'harbor/dandan';

type TaxonomyEntry = {
  legacyWing: string;
  legacyRoom: string;
  basin: TsunamiBasin;
  current: TsunamiCurrent;
  description: string;
};

type GraphRelation = {
  predicate: string;
  theme: 'structure' | 'flow' | 'evidence' | 'recovery' | 'drift';
  description: string;
  examples: string[];
};

const ENTITY_TYPES = [
  'agent',
  'person',
  'project',
  'task_thread',
  'handoff',
  'recovery_anchor',
  'checkpoint',
  'recovery_record',
  'memory_issue',
  'repair_suggestion',
  'wiki_page',
  'evidence_snippet',
  'memory_fragment',
  'basin',
  'current',
  'decision',
  'session_state',
  'feature',
  'unknown',
] as const satisfies readonly TsunamiEntityType[];

const TAXONOMY_ENTRIES: TaxonomyEntry[] = TSUNAMI_LEGACY_TAXONOMY_ENTRIES.map((entry) => ({
  legacyWing: entry.legacyWing,
  legacyRoom: entry.legacyRoom,
  basin: entry.basin as TsunamiBasin,
  current: entry.current as TsunamiCurrent,
  description: entry.description,
}));

const CURRENT_ALIASES: Record<string, TsunamiCurrent> = {
  signature: 'epicenter/signature',
  crest: 'epicenter/crest',
  law: 'epicenter/law',
  bridge: 'surface/bridge',
  helm: 'surface/helm',
  rigging: 'surface/rigging',
  hull: 'surface/hull',
  chart: 'surface/chart',
  echo: 'surface/echo',
  choice: 'faultline/choice',
  course: 'faultline/course',
  drift: 'faultline/drift',
  archive: 'abyss/archive',
  mesh: 'abyss/mesh',
  wake: 'abyss/wake',
  anchors: 'abyss/anchors',
  evidence: 'abyss/evidence',
  expedition: 'surge/expedition',
  tide: 'surge/tide',
  queue: 'surge/queue',
  blockers: 'surge/blockers',
  crew: 'harbor/crew',
  research: 'harbor/research',
  'liu-lie': 'harbor/liu-lie',
  dandan: 'harbor/dandan',
};

const LEGACY_BY_ROOM = new Map(TAXONOMY_ENTRIES.map((entry) => [entry.legacyRoom, entry]));
const TSUNAMI_BY_CURRENT = new Map(TAXONOMY_ENTRIES.map((entry) => [entry.current, entry]));
const LEGACY_BY_WING = TAXONOMY_ENTRIES.reduce<Map<string, TaxonomyEntry>>((map, entry) => {
  if (!map.has(entry.legacyWing)) {
    map.set(entry.legacyWing, entry);
  }
  return map;
}, new Map<string, TaxonomyEntry>());
function canonicalRoom(room: string): string {
  return normalizeTsunamiCompatRoom(room);
}

const DEFAULT_BY_BASIN: Record<TsunamiBasin, TsunamiCurrent> = {
  epicenter: 'epicenter/signature',
  surface: 'surface/bridge',
  faultline: 'faultline/choice',
  abyss: 'abyss/archive',
  surge: 'surge/expedition',
  harbor: 'harbor/crew',
};

const GRAPH_RELATIONS: GraphRelation[] = [
  {
    predicate: 'anchors_to',
    theme: 'structure',
    description: 'Welds handoff, checkpoint, recovery anchor, and task thread into one continuous mainline.',
    examples: ['handoff -> recovery_anchor', 'checkpoint -> task_thread'],
  },
  {
    predicate: 'flows_to',
    theme: 'flow',
    description: 'Describes flow between tasks, steps, status, and next actions.',
    examples: ['task_thread -> next_step', 'decision -> resulting_task'],
  },
  {
    predicate: 'feeds',
    theme: 'evidence',
    description: 'Represents evidence, wiki, and memory fragments feeding into higher-level decisions.',
    examples: ['evidence_snippet -> wiki_page', 'wiki_page -> planner_context'],
  },
  {
    predicate: 'crosscurrents_with',
    theme: 'drift',
    description: 'Indicates drift or conflict between two mainlines, anchors, or handoffs.',
    examples: ['handoff -> anchor', 'feature -> task_thread'],
  },
  {
    predicate: 'surges_from',
    theme: 'flow',
    description: 'Indicates a task surge, behavior, or strategy triggered by a decision or rule.',
    examples: ['task_surge -> decision', 'behavior -> identity_rule'],
  },
  {
    predicate: 'settles_into',
    theme: 'recovery',
    description: 'Represents execution results settling into handoff, archive, or stable state.',
    examples: ['turn_outcome -> handoff', 'active_task -> archive'],
  },
  {
    predicate: 'echoes',
    theme: 'drift',
    description: 'Represents duplicate, near-duplicate, restated, or echo memories.',
    examples: ['memory_fragment -> memory_fragment', 'anchor -> anchor'],
  },
  {
    predicate: 'belongs_to_basin',
    theme: 'structure',
    description: 'Tags memory fragments, currents, wikis, or threads into a TSUNAMI basin.',
    examples: ['memory_fragment -> abyss', 'task_thread -> surge'],
  },
  {
    predicate: 'restored_from',
    theme: 'recovery',
    description: 'Indicates current state was restored from a checkpoint, anchor, or recovery point.',
    examples: ['task_thread -> checkpoint', 'session_state -> recovery_anchor'],
  },
  {
    predicate: 'cites',
    theme: 'evidence',
    description: 'Represents citation relationships from wiki, handoff, or decision to evidence fragments.',
    examples: ['wiki_page -> evidence_snippet', 'handoff -> evidence_snippet'],
  },
];

export function listTsunamiTaxonomyEntries(): TaxonomyEntry[] {
  return [...TAXONOMY_ENTRIES];
}

export function describeTsunamiTaxonomy() {
  const basins = Array.from(new Set(TAXONOMY_ENTRIES.map((entry) => entry.basin))).map((basin) => ({
    basin,
    defaultCurrent: DEFAULT_BY_BASIN[basin],
    currents: TAXONOMY_ENTRIES.filter((entry) => entry.basin === basin).map((entry) => ({
      current: entry.current,
      legacyWing: entry.legacyWing,
      legacyRoom: entry.legacyRoom,
      description: entry.description,
    })),
  }));

  return {
    systemName: 'TSUNAMI',
    taxonomyVersion: 'v1',
    primaryNamespace: 'basin/current',
    compatibilityNamespace: 'wing/room',
    basins,
    aliases: TAXONOMY_ENTRIES.map((entry) => ({
      legacyWing: entry.legacyWing,
      legacyRoom: entry.legacyRoom,
      basin: entry.basin,
      current: entry.current,
    })),
  };
}

export function describeTsunamiGraphOntology() {
  return {
    systemName: 'TSUNAMI',
    ontologyVersion: 'v1',
    entityTypes: [...ENTITY_TYPES],
    relationTypes: GRAPH_RELATIONS,
  };
}

export function listTsunamiEntityTypes(): TsunamiEntityType[] {
  return [...ENTITY_TYPES];
}

export function normalizeTsunamiEntityType(value: unknown): TsunamiEntityType {
  const normalized = String(value ?? '').trim().toLowerCase().replace(/\s+/g, '_') as TsunamiEntityType | '';
  if (normalized && ENTITY_TYPES.includes(normalized as TsunamiEntityType)) {
    return normalized as TsunamiEntityType;
  }
  return 'unknown';
}

export function describeTsunamiRelation(predicate: unknown): GraphRelation | null {
  const normalized = String(predicate ?? '').trim().toLowerCase().replace(/\s+/g, '_');
  return GRAPH_RELATIONS.find((item) => item.predicate === normalized) ?? null;
}

export function listTsunamiGraphRelations(): GraphRelation[] {
  return [...GRAPH_RELATIONS];
}

function resolveCurrent(basin?: string, current?: string): TsunamiCurrent | null {
  const basinValue = String(basin ?? '').trim().toLowerCase() as TsunamiBasin | '';
  const currentValue = String(current ?? '').trim().toLowerCase();
  if (currentValue) {
    if (TSUNAMI_BY_CURRENT.has(currentValue as TsunamiCurrent)) {
      return currentValue as TsunamiCurrent;
    }
    const alias = CURRENT_ALIASES[currentValue];
    if (alias) {
      if (!basinValue || alias.startsWith(`${basinValue}/`)) return alias;
    }
    if (basinValue && CURRENT_ALIASES[currentValue] && CURRENT_ALIASES[currentValue].startsWith(`${basinValue}/`)) {
      return CURRENT_ALIASES[currentValue];
    }
  }
  if (basinValue && DEFAULT_BY_BASIN[basinValue]) {
    return DEFAULT_BY_BASIN[basinValue];
  }
  return null;
}

export function normalizeTsunamiTaxonomy(input: {
  wing?: string;
  room?: string;
  basin?: string;
  current?: string;
}): {
  wing: string;
  room: string;
  basin: TsunamiBasin;
  current: TsunamiCurrent;
  namespace: 'legacy' | 'tsunami' | 'mixed';
} {
  const wing = String(input.wing ?? '').trim();
  const room = String(input.room ?? '').trim();
  const resolvedRoom = normalizeTsunamiCompatRoom(room);
  const basin = String(input.basin ?? '').trim();
  const current = String(input.current ?? '').trim();

  if (basin || current) {
    const resolvedCurrent = resolveCurrent(basin, current);
    if (resolvedCurrent) {
      const entry = TSUNAMI_BY_CURRENT.get(resolvedCurrent)!;
      return {
        wing: entry.legacyWing,
        room: canonicalRoom(entry.legacyRoom),
        basin: entry.basin,
        current: entry.current,
        namespace: wing || room ? 'mixed' : 'tsunami',
      };
    }
  }

  const legacyEntry = LEGACY_BY_ROOM.get(resolvedRoom);
  if (legacyEntry) {
    return {
      wing: legacyEntry.legacyWing,
      room: canonicalRoom(legacyEntry.legacyRoom),
      basin: legacyEntry.basin,
      current: legacyEntry.current,
      namespace: 'legacy',
    };
  }

  const legacyWingEntry = LEGACY_BY_WING.get(wing);
  if (legacyWingEntry) {
    return {
      wing: legacyWingEntry.legacyWing,
      room: canonicalRoom(legacyWingEntry.legacyRoom),
      basin: legacyWingEntry.basin,
      current: legacyWingEntry.current,
      namespace: 'legacy',
    };
  }

  return {
    wing: wing || 'ats',
    room: room || TSUNAMI_DEFAULT_LEGACY_ROOM,
    basin: 'surface',
    current: 'surface/bridge',
    namespace: 'legacy',
  };
}

export function formatTsunamiTaxonomyText(): string {
  const taxonomy = describeTsunamiTaxonomy();
  const lines = [
    `TSUNAMI Taxonomy (${taxonomy.taxonomyVersion})`,
    `primary=${taxonomy.primaryNamespace} compatibility=${taxonomy.compatibilityNamespace}`,
    'bridge: legacy wing/room -> basin/current',
    '',
  ];
  for (const basin of taxonomy.basins) {
    lines.push(`[${basin.basin}] default=${basin.defaultCurrent}`);
    for (const current of basin.currents) {
      lines.push(`  - ${current.current} <= ${current.legacyWing}/${canonicalRoom(current.legacyRoom)}`);
    }
  }
  return lines.join('\n');
}

export function formatTsunamiGraphOntologyText(): string {
  const ontology = describeTsunamiGraphOntology();
  const lines = [
    `TSUNAMI Graph Ontology (${ontology.ontologyVersion})`,
    `entities=${ontology.entityTypes.join(', ')}`,
    '',
    'relations:',
  ];
  for (const relation of ontology.relationTypes) {
    lines.push(`- ${relation.predicate} [${relation.theme}] ${relation.description}`);
    lines.push(`  examples: ${relation.examples.join(' | ')}`);
  }
  return lines.join('\n');
}

export function formatTsunamiNormalizationText(input: {
  wing?: string;
  room?: string;
  basin?: string;
  current?: string;
}): string {
  const normalized = normalizeTsunamiTaxonomy(input);
  return [
    'TSUNAMI Normalization',
    `namespace=${normalized.namespace}`,
    `legacy=${normalized.wing}/${normalized.room}`,
    `tsunami=${normalized.basin}/${normalized.current}`,
  ].join('\n');
}
