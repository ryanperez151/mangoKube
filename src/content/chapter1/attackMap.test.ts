import { describe, it, expect } from 'vitest';
import { sentinelAttackMap } from './attackMap';
import { sentinelCampaign } from './sentinel';

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

  it('describes persistence without naming one decision-route identity', () => {
    const persistence = sentinelAttackMap.find((node) => node.id === 'persistence')!;
    expect(persistence.summary).not.toContain('log-rotator');
    expect(persistence.summary).not.toContain('metrics-reconciler');
  });

  it('references only facts that exist in the campaign fact library', () => {
    for (const node of sentinelAttackMap) {
      const referenced = [
        ...node.suspectedByFacts,
        ...node.confirmedByFacts,
        ...node.containedByFacts,
      ];
      for (const factId of referenced) {
        expect(
          sentinelCampaign.factLibrary[factId],
          `node "${node.id}" references unknown fact "${factId}"`
        ).toBeDefined();
      }
    }
  });

  it('maps every campaign fact to at least one node', () => {
    const mapped = new Set(
      sentinelAttackMap.flatMap((node) => [
        ...node.suspectedByFacts,
        ...node.confirmedByFacts,
        ...node.containedByFacts,
      ])
    );
    for (const factId of Object.keys(sentinelCampaign.factLibrary)) {
      expect(mapped.has(factId), `fact "${factId}" is not on the attack map`).toBe(true);
    }
  });
});
