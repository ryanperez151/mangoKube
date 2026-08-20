import { describe, it, expect } from 'vitest';
import { parseCommand } from './terminalParser';
import type { Stage } from '@/content/types';

const stage: Stage = {
  id: 'test-stage',
  title: 'Test Stage',
  briefing: [],
  objective: 'test',
  clusterInitial: {},
  commands: [
    {
      match: /^kubectl get pods$/i,
      description: 'kubectl get pods',
      outcome: { output: ['pod-a', 'pod-b'], revealsFacts: ['found-pods'] },
    },
    {
      match: /^kubectl describe pod pod-a$/i,
      description: 'kubectl describe pod pod-a',
      requiresFacts: ['found-pods'],
      outcome: { output: ['details of pod-a'], advances: true },
    },
  ],
};

describe('parseCommand', () => {
  it('matches a command with no prerequisites', () => {
    const outcome = parseCommand('kubectl get pods', stage, new Set());
    expect(outcome?.output).toEqual(['pod-a', 'pod-b']);
  });

  it('returns null when prerequisites are not met', () => {
    const outcome = parseCommand('kubectl describe pod pod-a', stage, new Set());
    expect(outcome).toBeNull();
  });

  it('matches a gated command once prerequisites are satisfied', () => {
    const outcome = parseCommand('kubectl describe pod pod-a', stage, new Set(['found-pods']));
    expect(outcome?.advances).toBe(true);
  });

  it('rejects a command hidden by an unselected decision option', () => {
    const conditionalStage: Stage = {
      ...stage,
      commands: [
        {
          match: /^contain$/i,
          description: 'contain',
          visibleWhen: { containment: 'contain-now' },
          outcome: { output: ['contained'] },
        },
      ],
    };

    expect(parseCommand('contain', conditionalStage, new Set(), { containment: 'hunt-first' })).toBeNull();
    expect(
      parseCommand('contain', conditionalStage, new Set(), { containment: 'contain-now' })?.output
    ).toEqual(['contained']);
  });

  it('returns null for unrecognized input', () => {
    const outcome = parseCommand('rm -rf /', stage, new Set());
    expect(outcome).toBeNull();
  });

  it('falls back to campaign-wide ambient commands', () => {
    const ambientCommands = [
      {
        match: /^whoami$/i,
        description: 'whoami',
        outcome: { output: ['root'] },
      },
    ];

    expect(parseCommand('whoami', stage, new Set(), {}, ambientCommands)?.output).toEqual([
      'root',
    ]);
  });

  it('keeps a matching stage command authoritative while it is fact-gated', () => {
    const gatedStage: Stage = {
      ...stage,
      commands: [
        {
          match: /^whoami$/i,
          description: 'whoami',
          requiresFacts: ['seen-pod'],
          outcome: { output: ['mission identity'] },
        },
      ],
    };
    const ambientCommands = [
      {
        match: /^whoami$/i,
        description: 'whoami',
        outcome: { output: ['root'] },
      },
    ];

    expect(parseCommand('whoami', gatedStage, new Set(), {}, ambientCommands)).toBeNull();
    expect(
      parseCommand('whoami', gatedStage, new Set(['seen-pod']), {}, ambientCommands)?.output
    ).toEqual(['mission identity']);
  });
});
