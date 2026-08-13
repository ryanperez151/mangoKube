import { describe, it, expect } from 'vitest';
import { findAdvancePath } from './reachability';
import type { LogEvent, Stage } from '@/content/types';

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

  it('advances via advanceWhen once pinnable events supply the facts', () => {
    const stage: Stage = {
      id: 's',
      title: 't',
      briefing: [],
      objective: 'o',
      clusterInitial: {},
      commands: [],
      advanceWhen: { facts: ['f1', 'f2'] },
    };
    const events: LogEvent[] = [
      {
        id: 'ev1',
        timestamp: '2026-08-12T02:00:00Z',
        source: 'edr',
        message: 'm',
        fields: {},
        arrivesAtStage: 0,
        revealsFact: 'f1',
      },
      {
        id: 'ev2',
        timestamp: '2026-08-12T02:01:00Z',
        source: 'k8s-audit',
        message: 'm',
        fields: {},
        arrivesAtStage: 0,
        revealsFact: 'f2',
      },
    ];
    expect(findAdvancePath(stage, { events, stageIndex: 0 })).toEqual(['pin ev1', 'pin ev2']);
  });

  it('ignores events that have not arrived yet', () => {
    const stage: Stage = {
      id: 's',
      title: 't',
      briefing: [],
      objective: 'o',
      clusterInitial: {},
      commands: [],
      advanceWhen: { facts: ['f1'] },
    };
    const events: LogEvent[] = [
      {
        id: 'ev-late',
        timestamp: '2026-08-12T02:00:00Z',
        source: 'edr',
        message: 'm',
        fields: {},
        arrivesAtStage: 3,
        revealsFact: 'f1',
      },
    ];
    expect(findAdvancePath(stage, { events, stageIndex: 0 })).toBeNull();
  });

  it('combines evidence and commands to reach a gated advancing command', () => {
    const stage: Stage = {
      id: 's',
      title: 't',
      briefing: [],
      objective: 'o',
      clusterInitial: {},
      commands: [
        {
          match: /^respond$/,
          description: 'respond',
          requiresFacts: ['f1'],
          outcome: { output: [], advances: true },
        },
      ],
    };
    const events: LogEvent[] = [
      {
        id: 'ev1',
        timestamp: '2026-08-12T02:00:00Z',
        source: 'edr',
        message: 'm',
        fields: {},
        arrivesAtStage: 0,
        revealsFact: 'f1',
      },
    ];
    expect(findAdvancePath(stage, { events, stageIndex: 0 })).toEqual(['pin ev1', 'respond']);
  });

  it('prefers a shorter evidence path over a longer command path', () => {
    const stage: Stage = {
      id: 's',
      title: 't',
      briefing: [],
      objective: 'o',
      clusterInitial: {},
      commands: [
        { match: /a/, description: 'cmdA', outcome: { output: [], revealsFacts: ['fA'] } },
        {
          match: /w/,
          description: 'cmdWin',
          requiresFacts: ['fA'],
          outcome: { output: [], advances: true },
        },
      ],
      advanceWhen: { facts: ['fB'] },
    };
    const events: LogEvent[] = [
      {
        id: 'evB',
        timestamp: '2026-08-12T02:00:00Z',
        source: 'edr',
        message: 'm',
        fields: {},
        arrivesAtStage: 0,
        revealsFact: 'fB',
      },
    ];
    expect(findAdvancePath(stage, { events, stageIndex: 0 })).toEqual(['pin evB']);
  });

  it('never treats an empty advanceWhen fact list as satisfied', () => {
    const stage: Stage = {
      id: 's',
      title: 't',
      briefing: [],
      objective: 'o',
      clusterInitial: {},
      commands: [],
      advanceWhen: { facts: [] },
    };
    const events: LogEvent[] = [
      {
        id: 'ev1',
        timestamp: '2026-08-12T02:00:00Z',
        source: 'edr',
        message: 'm',
        fields: {},
        arrivesAtStage: 0,
        revealsFact: 'f1',
      },
    ];
    expect(findAdvancePath(stage, { events, stageIndex: 0 })).toBeNull();
  });

  it('validates a decision route using only commands and evidence visible on that route', () => {
    const stage: Stage = {
      id: 's',
      title: 't',
      briefing: [],
      objective: 'o',
      clusterInitial: {},
      commands: [
        {
          match: /hunt/,
          description: 'hunt',
          visibleWhen: { containment: 'hunt-first' },
          outcome: { output: [], advances: true },
        },
        {
          match: /contain/,
          description: 'contain',
          visibleWhen: { containment: 'contain-now' },
          outcome: { output: [], advances: true },
        },
      ],
    };
    const events: LogEvent[] = [
      {
        id: 'hidden-evidence',
        timestamp: '2026-08-12T02:00:00Z',
        source: 'edr',
        message: 'm',
        fields: {},
        arrivesAtStage: 0,
        revealsFact: 'hidden-fact',
        visibleWhen: { containment: 'hunt-first' },
      },
    ];

    expect(findAdvancePath(stage, { decisions: { containment: 'hunt-first' }, events })).toEqual([
      'hunt',
    ]);
    expect(findAdvancePath(stage, { decisions: { containment: 'contain-now' }, events })).toEqual([
      'contain',
    ]);
  });

  it('starts a selected stage decision route with facts revealed by its effect', () => {
    const stage: Stage = {
      id: 's',
      title: 't',
      briefing: [],
      objective: 'o',
      clusterInitial: {},
      commands: [],
      advanceWhen: { facts: ['binding-revoked'] },
      decision: {
        id: 'containment',
        prompt: 'When?',
        options: [
          {
            id: 'contain-now',
            label: 'Contain now',
            description: 'Act immediately.',
            effects: { revealsFacts: ['binding-revoked'] },
          },
          { id: 'hunt-first', label: 'Hunt first', description: 'Gather evidence.' },
        ],
      },
    };

    expect(findAdvancePath(stage, { decisions: { containment: 'contain-now' } })).toEqual([]);
    expect(findAdvancePath(stage, { decisions: { containment: 'hunt-first' } })).toBeNull();
  });
});
