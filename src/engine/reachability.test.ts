import { describe, it, expect } from 'vitest';
import { findAdvancePath } from './reachability';
import type { Stage } from '@/content/types';

describe('findAdvancePath', () => {
  it('finds a path when commands must be run in fact order', () => {
    const stage: Stage = {
      id: 's',
      title: 't',
      briefing: [],
      objective: 'o',
      clusterInitial: {},
      commands: [
        { match: /a/, description: 'a', outcome: { output: [], revealsFacts: ['f1'] } },
        {
          match: /b/,
          description: 'b',
          requiresFacts: ['f1'],
          outcome: { output: [], advances: true },
        },
      ],
    };
    expect(findAdvancePath(stage)).toEqual(['a', 'b']);
  });

  it('returns null when no command sequence reaches advances: true', () => {
    const stage: Stage = {
      id: 's',
      title: 't',
      briefing: [],
      objective: 'o',
      clusterInitial: {},
      commands: [
        { match: /a/, description: 'a', outcome: { output: [], revealsFacts: ['f1'] } },
      ],
    };
    expect(findAdvancePath(stage)).toBeNull();
  });

  it('handles a stage with an immediately reachable advance command', () => {
    const stage: Stage = {
      id: 's',
      title: 't',
      briefing: [],
      objective: 'o',
      clusterInitial: {},
      commands: [{ match: /a/, description: 'a', outcome: { output: [], advances: true } }],
    };
    expect(findAdvancePath(stage)).toEqual(['a']);
  });

  it('finds a path when commands are in reverse dependency order', () => {
    const stage: Stage = {
      id: 's',
      title: 't',
      briefing: [],
      objective: 'o',
      clusterInitial: {},
      commands: [
        {
          match: /b/,
          description: 'b',
          requiresFacts: ['f1'],
          outcome: { output: [], advances: true },
        },
        { match: /a/, description: 'a', outcome: { output: [], revealsFacts: ['f1'] } },
      ],
    };
    expect(findAdvancePath(stage)).toEqual(['a', 'b']);
  });
});
