#!/usr/bin/env bun
/**
 * TSUNAMI Chinese Classifier Benchmark
 */
import { describe, it, expect } from 'bun:test';
import { classifyMemory, classifyTsunamiText } from '../src/tsunami_classifier';

const CN_BENCHMARKS: Array<{ text: string; wing: string }> = [
  { text: '我是一个AI角色，我的身份是工程师助手', wing: 'identity' },
  { text: '红线：绝对不能泄露用户数据', wing: 'identity' },
  { text: '铁律：永远不要直接执行破坏性操作', wing: 'identity' },
  { text: '我们决定采用 Redis 作为缓存方案', wing: 'decision' },
  { text: '最终方案是使用单体仓库 + turborepo', wing: 'decision' },
  { text: '放弃微服务方案，选择模块化单体架构', wing: 'decision' },
  { text: '核心任务：实现监控管道的心跳检查', wing: 'task' },
  { text: '日常任务：运行计划检查验证所有服务', wing: 'task' },
  { text: '需要部署新的认证模块到测试环境', wing: 'task' },
  { text: '知识图谱需要新的关系类型用于跨盆地链接', wing: 'memory' },
  { text: '长期记忆：我们需要压缩旧会话以节省存储', wing: 'memory' },
  { text: '语义搜索对向量嵌入返回了过期结果', wing: 'memory' },
  { text: '大脑模块使用新的提供者引擎进行语音合成', wing: 'brain' },
  { text: '配置端口需要更新以支持控制面板重启', wing: 'brain' },
  { text: '用户老板希望伙伴团队审查架构', wing: 'people' },
  { text: '团队反馈：同事偏好深色模式', wing: 'people' },
];

describe('Chinese classifier benchmark', () => {
  let correct = 0;

  for (const bm of CN_BENCHMARKS) {
    it(`"${bm.text.slice(0, 30)}..." → ${bm.wing}`, () => {
      const r = classifyMemory(bm.text);
      if (r?.wing === bm.wing) correct++;
      expect(r).not.toBeNull();
    });
  }

  it('Chinese accuracy >= 60%', () => {
    const rate = correct / CN_BENCHMARKS.length;
    console.log(`  Chinese wing accuracy: ${correct}/${CN_BENCHMARKS.length} = ${(rate * 100).toFixed(0)}%`);
    expect(rate).toBeGreaterThanOrEqual(0.6);
  });
});

describe('Chinese fallback', () => {
  it('meaningless Chinese text returns null', () => {
    expect(classifyMemory('今天天气真好适合出去走走')).toBeNull();
  });

  it('Chinese fallback returns surface/bridge', () => {
    const r = classifyTsunamiText('这是一个完全无关的句子');
    expect(r.basin).toBe('surface');
    expect(r.confidence).toBe(0.2);
  });
});
