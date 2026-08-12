import { describe, it, expect } from 'vitest';
import { sentinelAttackMap, deriveNodeState } from './attackMap';

describe('deriveNodeState', () => {
  const node = {
    id: 'n',
    label: 'n',
    tactic: 't',
    summary: 's',
    lesson: 'l',
    prevention: 'p',
    suspectedByFacts: ['a'],
    confirmedByFacts: ['a', 'b'],
    containedByFacts: ['c'],
    x: 0,
    y: 0,
  };

  it('is undiscovered with no facts', () => {
    expect(deriveNodeState(node, new Set())).toBe('undiscovered');
  });

  it('is suspected once the suspecting facts are all collected', () => {
    expect(deriveNodeState(node, new Set(['a']))).toBe('suspected');
  });

  it('is confirmed once the confirming facts are all collected', () => {
    expect(deriveNodeState(node, new Set(['a', 'b']))).toBe('confirmed');
  });

  it('is contained once the containing facts are all collected', () => {
    expect(deriveNodeState(node, new Set(['a', 'b', 'c']))).toBe('contained');
  });

  it('treats an empty fact list as never triggering', () => {
    const never = { ...node, suspectedByFacts: [], confirmedByFacts: [], containedByFacts: [] };
    expect(deriveNodeState(never, new Set(['a', 'b', 'c']))).toBe('undiscovered');
  });
});

describe('sentinelAttackMap', () => {
  it('uses unique node ids', () => {
    const ids = sentinelAttackMap.map((node) => node.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('points every parentId at a node that exists', () => {
    const ids = new Set(sentinelAttackMap.map((node) => node.id));
    for (const node of sentinelAttackMap) {
      if (node.parentId) {
        expect(ids.has(node.parentId), `${node.id} has unknown parent ${node.parentId}`).toBe(true);
      }
    }
  });

  it('has exactly one trunk node', () => {
    expect(sentinelAttackMap.filter((node) => !node.parentId)).toHaveLength(1);
  });

  it('gives every node a lesson and a prevention', () => {
    for (const node of sentinelAttackMap) {
      expect(node.lesson, `${node.id} has no lesson`).toBeTruthy();
      expect(node.prevention, `${node.id} has no prevention`).toBeTruthy();
    }
  });
});
