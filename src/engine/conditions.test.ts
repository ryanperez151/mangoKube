import { describe, expect, it } from 'vitest';
import { canChooseDecision, isChoiceVisible, resolveConditionalCopy } from './conditions';
import type { ConditionalCopy, MissionDecision } from '@/content/types';

describe('choice conditions', () => {
  it.each([
    ['before-stage without pending resolution', 'before-stage', null, true],
    ['before-stage with its resolution pending', 'before-stage', { stageId: 'escalation' }, false],
    ['after-stage without pending resolution', 'after-stage', null, false],
    ['after-stage with its resolution pending', 'after-stage', { stageId: 'escalation' }, true],
  ] as const)('accepts a %s decision only at its actionable lifecycle point', (_label, timing, pending, expected) => {
    const decision: MissionDecision = { id: 'route', timing, prompt: 'Route?', options: [] };

    expect(canChooseDecision(decision, 'escalation', pending, {})).toBe(expected);
    expect(canChooseDecision(decision, 'escalation', pending, { route: 'locked' })).toBe(false);
  });

  it('requires every decision in a visibility condition to match', () => {
    const condition = { containment: 'hunt-first', priority: 'evidence' };

    expect(isChoiceVisible(condition, { containment: 'hunt-first', priority: 'evidence' })).toBe(
      true
    );
    expect(isChoiceVisible(condition, { containment: 'hunt-first', priority: 'contain' })).toBe(
      false
    );
  });

  it('treats absent visibility conditions as visible', () => {
    expect(isChoiceVisible(undefined, {})).toBe(true);
  });

  it('returns only copy visible for the selected decisions', () => {
    const copy: ConditionalCopy[] = [
      { lines: ['Everyone sees this.'] },
      { when: { containment: 'hunt-first' }, lines: ['Hunt before containing.'] },
      { when: { containment: 'contain-now' }, lines: ['Contain immediately.'] },
    ];

    expect(resolveConditionalCopy(copy, { containment: 'hunt-first' })).toEqual([
      'Everyone sees this.',
      'Hunt before containing.',
    ]);
  });
});
