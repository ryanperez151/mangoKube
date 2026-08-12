import { describe, it, expect } from 'vitest';
import { deriveNodeState } from './attackMap';

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
