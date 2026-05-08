#!/usr/bin/env bun
/**
 * TSUNAMI Classifier Benchmark — validates classification accuracy
 * against known-good examples. Run with: bun test test/classifier_benchmark.test.ts
 */
import { describe, it, expect } from 'bun:test';
import { classifyMemory, classifyTsunamiText, classifyTsunamiTextMulti } from '../src/tsunami_classifier';

/** Known-good classification pairs. Each entry has text and the expected wing. */
const BENCHMARKS: Array<{ text: string; wing: string; room?: string }> = [
  // ── identity ──
  { text: 'whoami is an AI agent with a strong personality and iron_law principles', wing: 'identity', room: 'rules' },
  { text: 'red_line: never expose raw user data to third parties', wing: 'identity', room: 'rules' },
  { text: 'my role is to assist with engineering tasks and enforce coding standards', wing: 'identity', room: 'core' },
  { text: 'the deputy agent takes over when the primary is offline', wing: 'identity', room: 'core' },

  // ── decision ──
  { text: 'tech_selection: we adopted Redis for caching after evaluating several options', wing: 'decision', room: 'strategy' },
  { text: 'final_approach: decided to use a monorepo with turborepo for the frontend packages', wing: 'decision', room: 'strategy' },
  { text: 'We finalized the tech_stack: Bun + TypeScript + SQLite for the backend', wing: 'decision', room: 'strategy' },
  { text: 'abandoned the microservices approach in favor of a modular monolith', wing: 'decision', room: 'strategy' },

  // ── task ──
  { text: 'core_task phase_1: implement the heartbeat_check for the monitoring pipeline', wing: 'task', room: 'project' },
  { text: 'daily routine: run the scheduled_check to verify all services are up', wing: 'task', room: 'routine' },
  { text: 'need to deploy the new auth module to staging and run integration tests', wing: 'task', room: 'project' },

  // ── memory ──
  { text: 'the knowledge_graph needs a new relationship type for cross-basin links', wing: 'memory', room: 'graph' },
  { text: 'long_term_memory: we need to compress older sessions to save storage', wing: 'memory', room: 'tsunami' },
  { text: 'semantic_search is returning stale results for the vector embeddings', wing: 'memory', room: 'graph' },

  // ── brain ──
  { text: 'the brain module uses a new provider engine for TTS voice synthesis', wing: 'brain', room: 'tts' },
  { text: 'register a new tool loader for the executor', wing: 'brain', room: 'tools' },
  { text: 'the config port needs to be updated for the control_plane restart', wing: 'brain', room: 'config' },

  // ── people ──
  { text: 'the user boss wants the partner team to review the architecture', wing: 'people' },
  { text: 'feedback from the team: colleague prefers dark mode', wing: 'people' },
];

// ── Accuracy benchmark ──

describe('Classifier benchmark accuracy', () => {
  let correctWing = 0;
  let correctRoom = 0;
  let total = 0;

  for (const bm of BENCHMARKS) {
    it(`classifies "${bm.text.slice(0, 40)}..." → ${bm.wing}`, () => {
      const r = classifyMemory(bm.text);
      expect(r).not.toBeNull();
      if (r!.wing === bm.wing) correctWing++;
      if (bm.room && r!.room === bm.room) correctRoom++;
      total++;
    });
  }

  it('wing accuracy >= 80%', () => {
    const rate = correctWing / total;
    console.log(`  Wing accuracy: ${correctWing}/${total} = ${(rate * 100).toFixed(0)}%`);
    expect(rate).toBeGreaterThanOrEqual(0.8);
  });

  it('room accuracy >= 50%', () => {
    const withRoom = BENCHMARKS.filter(b => b.room).length;
    const rate = correctRoom / withRoom;
    console.log(`  Room accuracy: ${correctRoom}/${withRoom} = ${(rate * 100).toFixed(0)}%`);
    expect(rate).toBeGreaterThanOrEqual(0.5);
  });
});

// ── Confidence quality ──

describe('Confidence scoring', () => {
  it('strong keyword match has higher confidence than weak', () => {
    const strong = classifyMemory('iron_law red_line principle identity personality whoami');
    const weak = classifyMemory('development feature plan');
    expect(strong!.confidence).toBeGreaterThan(weak?.confidence ?? 0);
  });

  it('confidence is always in [0, 1]', () => {
    const texts = ['identity whoami', 'zzzz', 'iron_law red_line tech_selection final_approach heartbeat_check core_task'];
    for (const t of texts) {
      const r = classifyTsunamiText(t);
      expect(r.confidence).toBeGreaterThanOrEqual(0);
      expect(r.confidence).toBeLessThanOrEqual(1);
    }
  });

  it('multi-classification confidence decreases monotonically', () => {
    const r = classifyTsunamiTextMulti('iron_law identity personality tech_selection decision core_task heartbeat_check', 5);
    for (let i = 1; i < r.length; i++) {
      expect(r[i - 1].confidence).toBeGreaterThanOrEqual(r[i].confidence);
    }
  });
});

// ── Edge case regression ──

describe('Edge case regression', () => {
  it('empty string returns null from classifyMemory', () => {
    expect(classifyMemory('')).toBeNull();
  });

  it('meaningless text returns null', () => {
    expect(classifyMemory('lorem ipsum dolor sit amet consectetur adipiscing')).toBeNull();
  });

  it('very long input does not crash', () => {
    const long = 'development '.repeat(1000);
    const r = classifyTsunamiText(long);
    expect(r.basin).toBeDefined();
  });

  it('unicode / emoji does not crash', () => {
    const r = classifyTsunamiText('🚀🔧 implemented the core_task 💻');
    expect(r.basin).toBeDefined();
  });
});
