/**
 * TSUNAMI project state stubs
 *
 * Provides project-level state queries for the storm center.
 * Returns null/empty defaults; the storm center handles these gracefully.
 */

export interface ProjectTaskThread {
  id: string;
  title: string;
  status: string;
  summary?: string;
  nextStep?: string;
  featureId?: string;
}

export interface ProjectHandoffRecord {
  id: string;
  task: string;
  summary?: string;
  nextStep?: string;
  progressStatus?: string;
  progressFeatureId?: string;
}

export interface ProjectStateStatus {
  activeFeature?: {
    id?: string;
    title?: string;
    status?: string;
    detail?: string;
  } | null;
}

export interface ProjectWikiPage {
  pageId: string;
  title: string;
  summary: string;
  confidence: number;
  tags: string[];
  sourceRefs: string[];
  updatedAt: number;
}

export interface ProjectWikiEvidence {
  snippetId: string;
  pageId: string;
  title: string;
  sourcePath: string;
  sourceRef: string;
  quote: string;
  tags: string[];
}

export interface ProjectWikiQueryResult {
  evidence: ProjectWikiEvidence[];
}

export function getProjectStateStatus(_projectDir: string): ProjectStateStatus {
  return { activeFeature: null };
}

export function resolveProjectTaskThread(
  _projectDir: string,
  _query: string,
  _limit?: number,
): { thread: ProjectTaskThread | null; match: string | null } {
  return { thread: null, match: null };
}

export function getProjectLatestHandoff(
  _projectDir: string,
  _opts?: { sessionId?: string; featureId?: string },
): ProjectHandoffRecord | null {
  return null;
}

export function listProjectWikiPages(_projectDir: string, _limit?: number): ProjectWikiPage[] {
  return [];
}

export function queryProjectWiki(
  _projectDir: string,
  _query: string,
  _limit?: number,
): ProjectWikiQueryResult {
  return { evidence: [] };
}
