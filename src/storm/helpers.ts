// Storm center — utility functions
import { existsSync, readFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { listProjectWikiPages } from '../core/project_state';
import type { ProjectHandoffRecord, ProjectTaskThread } from '../core/project_state';
import type { DurableRecoveryRecord } from '../runtime/checkpoints/durable_recovery';
import type { TsunamiStormCenterCurrent, TsunamiStormCenter } from './types';

type TsunamiFallbackDocSupport = {
  anchors: TsunamiStormCenter['anchors'];
  evidence: TsunamiStormCenter['evidence'];
  mainlineTitle?: string;
  mainlineSummary?: string;
};

const TSUNAMI_STORM_RETRY_DELAYS_MS = [8, 18, 36] as const;

export function buildProjectNode(projectDir: string): string {
  return `project:${basename(projectDir) || projectDir}`;
}
export function buildTaskThreadNode(threadId: string): string {
  return `task_thread:${threadId}`;
}
export function buildHandoffNode(handoffId: string): string {
  return `handoff:${handoffId}`;
}
export function buildAnchorNode(pageId: string): string {
  return `recovery_anchor:${pageId}`;
}
export function buildRecoveryNode(recoveryId: string): string {
  return `recovery_record:${recoveryId}`;
}
export function clampEnergy(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, Number(value.toFixed(2))));
}
export function safeTrim(value: string | undefined, max = 160): string {
  const text = String(value ?? '').replace(/\s+/g, ' ').trim();
  if (!text) return '';
  return text.length > max ? `${text.slice(0, max)}...` : text;
}
export function blockForRetry(ms: number) {
  const delay = Math.max(0, Math.floor(ms));
  if (!delay) return;
  try {
    const shared = new SharedArrayBuffer(4);
    Atomics.wait(new Int32Array(shared), 0, 0, delay);
  } catch {
    const end = Date.now() + delay;
    while (Date.now() < end) {
      // Busy wait fallback for runtimes where Atomics.wait is unavailable.
    }
  }
}
export function isTsunamiStormRetryableError(error: unknown): boolean {
  const message = String((error as any)?.message || error || '').toLowerCase();
  if (!message) return false;
  return message.includes('database is locked')
    || message.includes('sqlite_busy')
    || message.includes('sql_busy')
    || message.includes('busy timeout');
}
export function withTsunamiStormRetry<T>(runner: () => T): T {
  let lastError: unknown;
  for (let attempt = 0; attempt <= TSUNAMI_STORM_RETRY_DELAYS_MS.length; attempt += 1) {
    try {
      return runner();
    } catch (error) {
      lastError = error;
      if (!isTsunamiStormRetryableError(error) || attempt >= TSUNAMI_STORM_RETRY_DELAYS_MS.length) {
        throw error;
      }
      blockForRetry(TSUNAMI_STORM_RETRY_DELAYS_MS[attempt]);
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError || 'unknown storm retry failure'));
}
export function pickFocusQuery(input: {
  query?: string;
  thread: ProjectTaskThread | null;
  handoff: ProjectHandoffRecord | null;
  activeFeatureTitle?: string;
}): string {
  const direct = String(input.query ?? '').trim();
  if (direct) return direct;
  return (
    input.thread?.title
    || input.handoff?.task
    || input.activeFeatureTitle
    || 'current mainline'
  );
}
export function tokenizeStormSupportQuery(query: string): string[] {
  return String(query || '')
    .toLowerCase()
    .split(/[\s,，。;；:：|/\\()\[\]{}"']+/)
    .map((item) => item.trim())
    .filter((item) => item.length >= 2);
}
export function pickFallbackDocSnippet(content: string, query: string, max = 180): string {
  const lines = String(content || '')
    .split('\n')
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .filter((line) => !/^#+\s*/.test(line));
  if (!lines.length) return '';
  const tokens = tokenizeStormSupportQuery(query);
  if (tokens.length > 0) {
    const matched = lines.find((line) => tokens.some((token) => line.toLowerCase().includes(token)));
    if (matched) return safeTrim(matched, max);
  }
  return safeTrim(lines.find((line) => line.length >= 20) || lines[0], max);
}
export function buildFallbackDocStormSupport(projectDir: string, focusQuery: string, limit = 2): TsunamiFallbackDocSupport {
  const candidates = [
    join(projectDir, 'README.md'),
    join(projectDir, 'CHANGELOG.md'),
    join(projectDir, 'README.md'),
  ];
  const anchors: TsunamiStormCenter['anchors'] = [];
  const evidence: TsunamiStormCenter['evidence'] = [];
  let mainlineTitle: string | undefined;
  let mainlineSummary: string | undefined;

  for (const filePath of candidates) {
    if (!existsSync(filePath)) continue;
    let content = '';
    try {
      content = readFileSync(filePath, 'utf8');
    } catch (error: any) {
      console.warn(`[TSUNAMI] failed to read fallback storm support doc ${filePath}:`, error?.message ?? error);
      continue;
    }
    const snippet = pickFallbackDocSnippet(content, focusQuery);
    if (!snippet) continue;
    const label = basename(filePath);
    if (!mainlineTitle) {
      mainlineTitle = `Project Mainline / ${label}`;
      mainlineSummary = snippet;
    }
    if (anchors.length < 1 && label === 'README.md') {
      anchors.push({
        pageId: `storm-fallback-anchor:${label}`,
        title: `Fallback Anchor / ${label}`,
        summary: snippet,
        confidence: 0.54,
        tags: ['storm-fallback', 'project-doc'],
      });
    }
    if (evidence.length < limit) {
      evidence.push({
        snippetId: `storm-fallback-evidence:${label}:${evidence.length + 1}`,
        pageId: `storm-fallback-doc:${label}`,
        title: `Fallback Evidence / ${label}`,
        sourcePath: filePath,
        sourceRef: `file:${label}`,
        quote: snippet,
        tags: ['storm-fallback', 'project-doc'],
      });
    }
  }

  return {
    anchors,
    evidence,
    mainlineTitle,
    mainlineSummary,
  };
}
export function readAnchorCandidates(projectDir: string, featureId?: string, limit = 3) {
  const pages = listProjectWikiPages(projectDir, 12)
    .filter((page) => page.title.startsWith('Recovery Anchor /') || page.tags.includes('recovery-anchor'))
    .filter((page) => {
      if (!featureId) return true;
      return page.sourceRefs.some((ref) => ref.toLowerCase() === `feature_id:${featureId.toLowerCase()}`);
    })
    .sort((a, b) => b.updatedAt - a.updatedAt);
  return pages.slice(0, limit);
}
