#!/usr/bin/env bun
/**
 * TSUNAMI Storm Center Unit Tests
 *
 * Tests the pure analysis functions in the storm pipeline:
 * mode, pressure, readiness, gate, budget, confidence with deterministic inputs.
 */
import { describe, it, expect } from 'bun:test';
import { buildCurrentMix } from '../src/storm/signals';
import { buildStormMode } from '../src/storm/mode';
import { buildStormPressure } from '../src/storm/pressure';
import { buildStormReadiness } from '../src/storm/readiness';
import { buildStormGate } from '../src/storm/gate';
import { buildStormBudget } from '../src/storm/budget';
import { buildStormConfidence } from '../src/storm/confidence';
import { buildStormHorizon } from '../src/storm/horizon';
import { buildStormBoundary } from '../src/storm/boundary';
import { buildStormDirective, buildStormAction } from '../src/storm/directive';
import { buildStormSelection } from '../src/storm/selection';
import { buildStormCoverage } from '../src/storm/coverage';
import { buildStormSaturation } from '../src/storm/saturation';
import { buildStormIntake } from '../src/storm/intake';
import { clampEnergy, safeTrim } from '../src/storm/helpers';
import type {
  TsunamiStormCenterCurrent,
  TsunamiStormCenterCurrentMix,
  TsunamiStormCenterStormMode,
} from '../src/storm/types';

// ── Helpers to build test inputs ──────────────────────────

function c(kind: string, energy: number): TsunamiStormCenterCurrent {
  return { kind: kind as any, label: `test-${kind}`, energy };
}

function makeMix(currents: TsunamiStormCenterCurrent[]): TsunamiStormCenterCurrentMix[] {
  return buildCurrentMix(currents);
}

function strongThread() {
  return makeMix([c('primary_thread', 0.95), c('evidence', 0.5)]);
}

function mixedSignals() {
  return makeMix([c('primary_thread', 0.5), c('repair', 0.5), c('evidence', 0.4)]);
}

function repairHeavy() {
  return makeMix([c('repair', 0.85), c('issue', 0.7), c('primary_thread', 0.3)]);
}

function weakSignals() {
  return makeMix([c('evidence', 0.3)]);
}

// ── Helpers ───────────────────────────────────────────────

describe('clampEnergy', () => {
  it('clamps within [0,1]', () => {
    expect(clampEnergy(0.5)).toBe(0.5);
  });
  it('clamps negatives to 0', () => {
    expect(clampEnergy(-1)).toBe(0);
  });
  it('clamps over 1 to 1', () => {
    expect(clampEnergy(1.5)).toBe(1);
  });
  it('handles NaN', () => {
    expect(clampEnergy(NaN)).toBe(0);
  });
  it('handles Infinity (returns 0 — not finite)', () => {
    expect(clampEnergy(Infinity)).toBe(0);
  });
});

describe('safeTrim', () => {
  it('trims and collapses whitespace', () => {
    expect(safeTrim('hello   world')).toBe('hello world');
  });
  it('truncates long text', () => {
    expect(safeTrim('x'.repeat(200), 100).endsWith('...')).toBe(true);
  });
});

// ── Current Mix ──────────────────────────────────────────

describe('buildCurrentMix', () => {
  it('aggregates by kind', () => {
    const mix = makeMix([c('primary_thread', 0.8), c('primary_thread', 0.2), c('repair', 0.5)]);
    expect(mix.length).toBe(2);
    const thread = mix.find(m => m.kind === 'primary_thread');
    expect(thread).toBeDefined();
    expect(thread!.count).toBe(2);
    expect(thread!.energy).toBeCloseTo(1.0, 0);
  });

  it('sorts by energy descending', () => {
    const mix = makeMix([c('evidence', 0.3), c('repair', 0.9), c('primary_thread', 0.6)]);
    expect(mix[0].kind).toBe('repair');
  });
});

// ── Storm Mode ────────────────────────────────────────────

describe('buildStormMode', () => {
  it('detects thread-led mode', () => {
    const mix = strongThread();
    const mode = buildStormMode(mix);
    expect(mode).toBeDefined();
    expect(mode!.dominantKind).toBe('primary_thread');
    expect(mode!.mixed).toBe(false);
    expect(mode!.label).toContain('thread');
  });

  it('detects repair-heavy mode', () => {
    const mix = repairHeavy();
    const mode = buildStormMode(mix);
    expect(mode!.dominantKind).toBe('repair');
    expect(mode!.label).toContain('repair');
  });

  it('detects mixed mode when dominance is split', () => {
    const mix = mixedSignals();
    const mode = buildStormMode(mix);
    expect(mode!.mixed).toBe(true);
    expect(mode!.label).toContain('mixed');
  });

  it('returns undefined for empty mix', () => {
    expect(buildStormMode([])).toBeUndefined();
  });
});

// ── Storm Pressure ────────────────────────────────────────

describe('buildStormPressure', () => {
  it('returns calm for weak signals', () => {
    const p = buildStormPressure({
      currentMix: weakSignals(),
      issues: [],
      repairSuggestions: [],
      anchors: [],
      evidence: [],
      recovery: null,
    });
    expect(p).toBeDefined();
    expect(p!.level).toBe('calm');
  });

  it('returns rising or critical for high P0 repairs + high issues', () => {
    const p = buildStormPressure({
      currentMix: repairHeavy(),
      stormMode: { label: 'repair-heavy', dominantKind: 'repair', dominance: 0.8, mixed: true },
      issues: [{ code: 'M001', severity: 'high', detail: 'critical' }, { code: 'M002', severity: 'high', detail: 'urgent' }],
      repairSuggestions: [{ title: 'fix A', priority: 'P0', detail: 'urgent' }, { title: 'fix B', priority: 'P0', detail: 'urgent' }],
      anchors: [],
      evidence: [],
      recovery: { recoveryId: 'r1', lineageDepth: 5, note: 'deep', source: 'test' } as any,
    });
    expect(['rising', 'critical']).toContain(p!.level);
    expect(p!.score).toBeGreaterThan(0.5);
  });

  it('stabilizers reduce pressure', () => {
    const high = buildStormPressure({
      currentMix: repairHeavy(),
      issues: [{ code: 'M001', severity: 'high', detail: 'x' }],
      repairSuggestions: [],
      anchors: [{ pageId: 'a', title: 'Anchor', summary: 's', confidence: 0.8, tags: [] },
                 { pageId: 'b', title: 'Anchor2', summary: 's2', confidence: 0.9, tags: [] }],
      evidence: [{ snippetId: 'e1', pageId: 'p1', title: 'Ev', quote: 'q', tags: [] }],
      recovery: null,
    });
    const low = buildStormPressure({
      currentMix: repairHeavy(),
      issues: [{ code: 'M001', severity: 'high', detail: 'x' }],
      repairSuggestions: [],
      anchors: [],
      evidence: [],
      recovery: null,
    });
    expect(high!.score).toBeLessThan(low!.score);
  });

  it('score is always in [0,1]', () => {
    const p = buildStormPressure({
      currentMix: strongThread(),
      issues: [],
      repairSuggestions: [],
      anchors: [],
      evidence: [],
      recovery: null,
    })!;
    expect(p.score).toBeGreaterThanOrEqual(0);
    expect(p.score).toBeLessThanOrEqual(1);
  });
});

// ── Storm Readiness ───────────────────────────────────────

describe('buildStormReadiness', () => {
  it('returns weak when nothing is available', () => {
    const r = buildStormReadiness({
      hasMainline: false,
      anchors: [],
      evidence: [],
      recovery: null,
      graphEdges: 0,
    });
    expect(r.level).toBe('weak');
    expect(r.gaps.length).toBeGreaterThan(0);
  });

  it('returns fortified when all signals present', () => {
    const r = buildStormReadiness({
      hasMainline: true,
      anchors: [{ pageId: 'a', title: 'A', summary: 's', confidence: 0.9, tags: [] },
                { pageId: 'b', title: 'B', summary: 's2', confidence: 0.8, tags: [] }],
      evidence: [{ snippetId: 'e', pageId: 'p', title: 'E', quote: 'q', tags: [] }],
      recovery: { recoveryId: 'r1', lineageDepth: 2, note: 'ok', source: 'test' } as any,
      graphEdges: 10,
    });
    expect(r.level).toBe('fortified');
  });
});

// ── Storm Gate ────────────────────────────────────────────

describe('buildStormGate', () => {
  it('returns hold when pressure is critical', () => {
    const g = buildStormGate({
      stormPressure: { level: 'critical', score: 0.9, reasons: [] },
    });
    expect(g!.verdict).toBe('hold');
    expect(g!.allowForward).toBe(false);
  });

  it('returns guarded when readiness is weak', () => {
    const g = buildStormGate({
      stormReadiness: { level: 'weak', score: 0.2, gaps: ['mainline'] },
    });
    expect(g!.verdict).toBe('guarded');
  });

  it('returns proceed for normal conditions', () => {
    const g = buildStormGate({
      stormPressure: { level: 'steady', score: 0.4, reasons: [] },
      stormReadiness: { level: 'ready', score: 0.7, gaps: [] },
      stormConfidence: { level: 'confident', score: 0.6, reason: 'ok' },
      stormBoundary: { mode: 'guarded', expand: false, reason: 'stable' },
    });
    expect(g!.verdict).toBe('proceed');
    expect(g!.allowForward).toBe(true);
  });

  it('returns expand for high confidence sealed boundary', () => {
    const g = buildStormGate({
      stormPressure: { level: 'calm', score: 0.1, reasons: [] },
      stormReadiness: { level: 'fortified', score: 0.9, gaps: [] },
      stormConfidence: { level: 'high', score: 0.85, reason: 'strong' },
      stormBoundary: { mode: 'sealed', expand: false, reason: 'tight' },
      stormHorizon: { label: 'multi_step', steps: 3, reason: 'clear' },
    });
    expect(g!.verdict).toBe('expand');
  });
});

// ── Storm Budget ──────────────────────────────────────────

describe('buildStormBudget', () => {
  it('returns frozen when gate is hold', () => {
    const b = buildStormBudget({
      stormGate: { verdict: 'hold', allowForward: false, reason: 'critical' },
    });
    expect(b!.mode).toBe('frozen');
    expect(b!.steps).toBe(0);
  });

  it('returns guided for normal proceed', () => {
    const b = buildStormBudget({
      stormGate: { verdict: 'proceed', allowForward: true, reason: 'ok' },
    });
    expect(b!.mode).toBe('guided');
    expect(b!.steps).toBeGreaterThanOrEqual(1);
  });

  it('returns open for expand + high confidence', () => {
    const b = buildStormBudget({
      stormGate: { verdict: 'expand', allowForward: true, reason: 'strong' },
      stormConfidence: { level: 'high', score: 0.9, reason: 'strong' },
      stormHorizon: { label: 'multi_step', steps: 3, reason: 'clear' },
    });
    expect(b!.mode).toBe('open');
  });
});

// ── Storm Confidence ──────────────────────────────────────

describe('buildStormConfidence', () => {
  it('returns high for fortified + sealed + calm', () => {
    const c = buildStormConfidence({
      stormPressure: { level: 'calm', score: 0.1, reasons: [] },
      stormReadiness: { level: 'fortified', score: 0.9, gaps: [] },
      stormBoundary: { mode: 'sealed', expand: false, reason: 'tight' },
      stormHorizon: { label: 'multi_step', steps: 3, reason: 'clear' },
    });
    expect(c!.level).toBe('high');
  });

  it('returns low for critical + weak + spilling', () => {
    const c = buildStormConfidence({
      stormPressure: { level: 'critical', score: 0.85, reasons: ['P0'] },
      stormReadiness: { level: 'weak', score: 0.15, gaps: ['mainline'] },
      stormBoundary: { mode: 'spilling', expand: false, reason: 'danger' },
      stormHorizon: { label: 'single_step', steps: 1, reason: 'urgent' },
    });
    expect(c!.level).toBe('low');
  });

  it('score is always in [0,1]', () => {
    const c = buildStormConfidence({
      stormPressure: { level: 'steady', score: 0.4, reasons: [] },
      stormReadiness: { level: 'ready', score: 0.7, gaps: [] },
    })!;
    expect(c.score).toBeGreaterThanOrEqual(0);
    expect(c.score).toBeLessThanOrEqual(1);
  });
});

// ── Pipeline integration: mode → pressure → gate → budget ──

describe('storm pipeline integration', () => {
  it('strong signals → calm pressure → guarded gate → minimal budget', () => {
    const mix = strongThread();
    const mode = buildStormMode(mix);
    const pressure = buildStormPressure({
      currentMix: mix,
      issues: [],
      repairSuggestions: [],
      anchors: [],
      evidence: [],
      recovery: null,
    })!;
    const gate = buildStormGate({ stormPressure: pressure })!;
    const budget = buildStormBudget({ stormGate: gate })!;

    expect(mode!.dominantKind).toBe('primary_thread');
    expect(['calm', 'steady']).toContain(pressure.level);
    expect(['frozen', 'minimal']).toContain(budget.mode); // weak readiness → restricted budget
    expect(budget.steps).toBeGreaterThanOrEqual(0);
  });

  it('repair heavy + critical pressure → hold → frozen', () => {
    const mix = repairHeavy();
    const mode = buildStormMode(mix);
    const pressure = buildStormPressure({
      currentMix: mix,
      stormMode: { label: 'repair-heavy', dominantKind: 'repair', dominance: 0.9, mixed: true },
      issues: [{ code: 'M001', severity: 'high', detail: 'broken' }, { code: 'M002', severity: 'high', detail: 'broken2' }],
      repairSuggestions: [{ title: 'fix', priority: 'P0', detail: 'critical' }, { title: 'fix2', priority: 'P0', detail: 'urgent' }],
      anchors: [],
      evidence: [],
      recovery: { recoveryId: 'r', lineageDepth: 8, note: 'deep', source: 'test' } as any,
    })!;
    const confidence = buildStormConfidence({ stormPressure: pressure })!;
    const gate = buildStormGate({ stormPressure: pressure, stormConfidence: confidence })!;
    const budget = buildStormBudget({ stormGate: gate })!;

    expect(mode!.dominantKind).toBe('repair');
    expect(gate.verdict).toBe('hold');
    expect(budget.mode).toBe('frozen');
  });
});
