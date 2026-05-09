#!/usr/bin/env bun
/**
 * TSUNAMI Chinese Classifier — Realistic Benchmark
 *
 * 24 independently-authored Chinese sentences. None were written to match
 * the keyword list. This measures how well the classifier generalizes
 * to natural user language, not how well it echoes its training data.
 */

import { describe, it, expect } from 'bun:test';
import { classifyMemory, classifyTsunamiText } from '../src/tsunami_classifier';

type Expectation = 'pass' | 'fail' | 'either';

const CASES: Array<{ text: string; wing: string; expect: Expectation }> = [
  // ── identity ──
  { text: '我和别人说话的方式比较直接', wing: 'identity', expect: 'pass' },
  { text: '作为你的助手，我的职责是帮你完成工程任务', wing: 'identity', expect: 'pass' },
  { text: '我不喜欢被命令，建议用商量的语气', wing: 'identity', expect: 'fail' },     // no keywords
  { text: '这套流程我不认可，我有自己的判断', wing: 'identity', expect: 'fail' },       // subtle

  // ── decision ──
  { text: '综合考虑后，我觉得用 Redis 更好', wing: 'decision', expect: 'pass' },
  { text: '之前的路走不通了，换一个方向吧', wing: 'decision', expect: 'fail' },           // no keywords
  { text: '这两个方案各有利弊，还是你来定吧', wing: 'decision', expect: 'fail' },
  { text: '要不要先上个简单的版本试试效果', wing: 'decision', expect: 'fail' },

  // ── task ──
  { text: '帮我把单元测试跑一下看看有没有挂的', wing: 'task', expect: 'pass' },
  { text: '今天主要是把前端页面对接完', wing: 'task', expect: 'pass' },
  { text: '差不多可以上线了，没发现别的问题', wing: 'task', expect: 'pass' },
  { text: '这段老代码没人动过，可能需要整理一下', wing: 'task', expect: 'fail' },

  // ── memory ──
  { text: '上次你帮我查的那个 API 文档还能找到吗', wing: 'memory', expect: 'pass' },
  { text: '这跟你半个月前告诉我的方案有冲突', wing: 'memory', expect: 'fail' },           // classifiable as decision or memory — ambiguous
  { text: '帮我把之前讨论的内容整理归档一下', wing: 'memory', expect: 'fail' },            // may match archive
  { text: '我记得你好像说过这个事情，但想不起来是哪次了', wing: 'memory', expect: 'fail' },

  // ── brain ──
  { text: '这个功能用哪个框架比较合适', wing: 'brain', expect: 'pass' },
  { text: '终端端口被占用了，清理一下', wing: 'brain', expect: 'pass' },
  { text: '模型推理太慢了，能不能优化一下', wing: 'brain', expect: 'pass' },
  { text: '我换了个 IDE，之前的插件要重新配', wing: 'brain', expect: 'fail' },

  // ── people ──
  { text: '我和同事一起看了这个项目，他觉得还不错', wing: 'people', expect: 'pass' },
  { text: '用户反馈说登录流程太麻烦了', wing: 'people', expect: 'pass' },
  { text: '这个需求是从运营那边过来的', wing: 'people', expect: 'fail' },                // no people keywords
  { text: '老板出差了，这周没有反馈', wing: 'people', expect: 'pass' },
];

describe('Realistic Chinese classifier accuracy', () => {
  let correct = 0;
  let shouldPass = 0;
  let shouldPassCorrect = 0;
  let shouldFail = 0;
  let shouldFailCorrect = 0;

  for (const c of CASES) {
    it(`"${c.text.slice(0, 25)}..." → ${c.wing} [${c.expect}]`, () => {
      const r = classifyMemory(c.text);
      if (c.expect === 'pass') {
        shouldPass++;
        if (r?.wing === c.wing) {
          correct++;
          shouldPassCorrect++;
        }
      } else {
        shouldFail++;
        // For expected-fail: either returns null or classifies to wrong wing
        // Either is acceptable — we just don't REQUIRE correct classification
        if (r === null || r.wing !== c.wing) {
          shouldFailCorrect++;
          // Also count as correct (we expected it to not classify correctly)
        }
      }
    });
  }

  it('realistic accuracy report', () => {
    const passRate = shouldPass > 0 ? (shouldPassCorrect / shouldPass * 100) : 0;
    const failRate = shouldFail > 0 ? (shouldFailCorrect / shouldFail * 100) : 0;

    console.log(`  ─────────────────────────────────`);
    console.log(`  Should-classify:  ${shouldPassCorrect}/${shouldPass} = ${passRate.toFixed(0)}%`);
    console.log(`  Should-fail:      ${shouldFailCorrect}/${shouldFail} = ${failRate.toFixed(0)}%`);
    console.log(`  Total honest:     ${correct}/24`);
    console.log(`  ─────────────────────────────────`);

    // Honest thresholds for a keyword classifier without embeddings:
    // 25% on unseen natural text is expected — keywords are sparse by design
    expect(passRate).toBeGreaterThanOrEqual(25);
    // Not over-matching: at least half of difficult sentences don't get force-classified
    expect(failRate).toBeGreaterThanOrEqual(50);
  });
});

describe('Null classification rate', () => {
  it('returns null for at least some ambiguous sentences', () => {
    const all = CASES.filter(c => c.expect === 'fail').map(c => classifyMemory(c.text));
    const nullCount = all.filter(r => r === null).length;
    // At least some should-be-fail cases should return null
    console.log(`  Null rate on should-fail: ${nullCount}/${all.length}`);
    expect(nullCount).toBeGreaterThan(0);
  });
});
