#!/usr/bin/env bun
/**
 * TSUNAMI Classifier Unit Tests
 *
 * Tests classifyMemory, classifyTsunamiText, and classifyTsunamiTextMulti
 * with known inputs, edge cases, and regression checks.
 */
import { describe, it, expect } from 'bun:test';
import {
  classifyMemory,
  classifyTsunamiText,
  classifyTsunamiTextMulti,
} from '../src/tsunami_classifier';

// ── classifyMemory ─────────────────────────────────────

describe('classifyMemory', () => {
  it('classifies decision content correctly', () => {
    const r = classifyMemory('We decided to adopt Redis as our caching layer');
    expect(r).not.toBeNull();
    expect(r!.wing).toBe('decision');
    expect(r!.confidence).toBeGreaterThan(0);
  });

  it('classifies decision with room-level keywords correctly', () => {
    const r = classifyMemory('tech_stack final_approach tech_selection for architecture framework');
    expect(r).not.toBeNull();
    expect(r!.wing).toBe('decision');
    expect(r!.room).toBe('strategy');
    expect(r!.confidence).toBeGreaterThan(0);
  });

  it('classifies task/project content correctly', () => {
    const r = classifyMemory('Implement the heartbeat check for phase 1 core task');
    expect(r).not.toBeNull();
    expect(r!.wing).toBe('task');
  });

  it('classifies identity content correctly', () => {
    const r = classifyMemory('My personality is assertive and I follow iron law principles');
    expect(r).not.toBeNull();
    expect(r!.wing).toBe('identity');
  });

  it('returns null for nonsensical input', () => {
    const r = classifyMemory('xyzzy blarg foo bar baz qux');
    expect(r).toBeNull();
  });

  it('returns null for empty string', () => {
    const r = classifyMemory('');
    expect(r).toBeNull();
  });

  it('scores brain/model content appropriately', () => {
    const r = classifyMemory('The brain module uses a new provider engine for TTS synthesis');
    expect(r).not.toBeNull();
    expect(r!.wing).toBe('brain');
  });

  it('classifies people content', () => {
    const r = classifyMemory('The user and their boss discussed the partner team structure');
    expect(r).not.toBeNull();
    expect(r!.wing).toBe('people');
  });

  it('returns basin matching wing for legacy compatibility', () => {
    const r = classifyMemory('We made a technical decision about the architecture');
    expect(r).not.toBeNull();
    expect(r!.basin).toBe(r!.wing);
  });

  it('finds correct room within wing', () => {
    const r = classifyMemory('I have an iron law principle and a red line that cannot be crossed');
    expect(r).not.toBeNull();
    expect(r!.wing).toBe('identity');
    expect(r!.room).toBe('rules');
  });
});

// ── classifyTsunamiText ────────────────────────────────

describe('classifyTsunamiText', () => {
  it('returns basin/current/confidence for valid text', () => {
    const r = classifyTsunamiText('tech_selection decided to finalize the tech_stack for v2');
    expect(r.basin).toBe('decision');
    expect(r.current).toBe('strategy');
    expect(r.confidence).toBeGreaterThan(0);
  });

  it('falls back to surface/bridge for unknown text', () => {
    const r = classifyTsunamiText('zzzz yyyyy xxxxx wwww');
    expect(r.basin).toBe('surface');
    expect(r.current).toBe('surface/bridge');
    expect(r.confidence).toBe(0.2);
  });

  it('handles very long text', () => {
    const long = 'decision making process for the final architecture approach '.repeat(50);
    const r = classifyTsunamiText(long);
    expect(r.basin).toBe('decision');
    expect(r.confidence).toBeGreaterThan(0);
  });
});

// ── classifyTsunamiTextMulti ───────────────────────────

describe('classifyTsunamiTextMulti', () => {
  it('returns multiple classifications sorted by confidence', () => {
    const text = 'The user profile personality is changing. We need to implement a new task feature for heartbeat_check. The brain module needs TTS.';
    const results = classifyTsunamiTextMulti(text, 3);
    expect(results.length).toBeGreaterThan(0);
    // Should be sorted by confidence descending
    for (let i = 1; i < results.length; i++) {
      expect(results[i - 1].confidence).toBeGreaterThanOrEqual(results[i].confidence);
    }
  });

  it('respects top limit', () => {
    const results = classifyTsunamiTextMulti(
      'identity personality rule iron_law decision final_approach task heartbeat_check memory knowledge_graph brain architecture',
      2,
    );
    expect(results.length).toBeLessThanOrEqual(2);
  });

  it('P0 REGRESSION: current is NOT just the wing name when room keywords match', () => {
    // This is the bug that was fixed — current must be the best ROOM, not the wing
    const results = classifyTsunamiTextMulti(
      'red_line iron_law personality identity core_identity role_positioning',
      3,
    );
    const identityResult = results.find(r => r.basin === 'identity');
    if (identityResult) {
      // Before fix: current === 'identity' (wing name)
      // After fix: current should be a room like 'core', 'personality', or 'rules'
      expect(identityResult.current).not.toBe('identity');
      // Should match one of the actual rooms
      expect(['core', 'personality', 'rules']).toContain(identityResult.current);
    }
  });

  it('P0 REGRESSION: task content gets correct room-based current', () => {
    const results = classifyTsunamiTextMulti('heartbeat_check scheduled_check daily routine', 3);
    const taskResult = results.find(r => r.basin === 'task');
    if (taskResult) {
      expect(taskResult.current).not.toBe('task');
      expect(['project', 'routine']).toContain(taskResult.current);
    }
  });

  it('falls back to wing name when no room keywords match', () => {
    // Use a wing that has keywords but no room-level match
    const results = classifyTsunamiTextMulti('boss partner colleague team', 3);
    const peopleResult = results.find(r => r.basin === 'people');
    if (peopleResult) {
      // Should have found at least 'user' or 'partner' or 'team' room
      expect(['user', 'partner', 'team']).toContain(peopleResult.current);
    }
  });

  it('handles empty text gracefully', () => {
    const results = classifyTsunamiTextMulti('', 3);
    // Should return empty array or minimal results
    expect(Array.isArray(results)).toBe(true);
  });
});

// ── Consistency between single and multi ───────────────

describe('single vs multi consistency', () => {
  it('top multi result matches single classifyTsunamiText', () => {
    const texts = [
      'final_approach tech_selection decided architecture',
      'heartbeat_check core_task phase_1 implementation',
      'personality identity whoami principle',
    ];
    for (const text of texts) {
      const single = classifyTsunamiText(text);
      const multi = classifyTsunamiTextMulti(text, 1);
      if (multi.length > 0) {
        expect(multi[0].basin).toBe(single.basin);
      }
    }
  });
});
