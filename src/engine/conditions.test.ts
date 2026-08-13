import { describe, expect, it } from 'vitest';
import { isChoiceVisible, resolveConditionalCopy } from './conditions';
import type { ConditionalCopy } from '@/content/types';

describe('choice conditions', () => {
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
