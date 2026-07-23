import { describe, it, expect, beforeEach } from 'vitest';
import { useSimStore } from './store';
import type { Campaign } from '@/content/types';

const testCampaign: Campaign = {
  id: 'infiltrator',
  title: 'Test Campaign',
  tagline: '',
  factLibrary: {},
  debrief: { narrative: [], lesson: '', nextChapterTeaser: '' },
  stages: [
    {
      id: 'stage-1',
      title: 'Stage 1',
      briefing: [],
      objective: 'o',
      clusterInitial: { status: 'nominal' },
      commands: [
        {
          match: /^look$/,
          description: 'look',
          outcome: { output: ['you see a pod'], revealsFacts: ['seen-pod'] },
        },
        {
          match: /^act$/,
          description: 'act',
          requiresFacts: ['seen-pod'],
          outcome: { output: ['advancing'], advances: true, clusterDelta: { status: 'suspicious' } },
        },
      ],
    },
    {
      id: 'stage-2',
      title: 'Stage 2',
      briefing: [],
      objective: 'o2',
      clusterInitial: { status: 'suspicious' },
      commands: [],
    },
  ],
};

beforeEach(() => {
  useSimStore.getState().resetProgress();
  localStorage.clear();
});

describe('useSimStore', () => {
  it('starts a campaign at stage 0 with initial cluster status', () => {
    useSimStore.getState().startCampaign(testCampaign);
    const state = useSimStore.getState();
    expect(state.stageIndex).toBe(0);
    expect(state.clusterStatus).toBe('nominal');
  });

  it('reveals facts without advancing when a gated command is not yet unlocked', () => {
    useSimStore.getState().startCampaign(testCampaign);
    useSimStore.getState().runCommand('look');
    const state = useSimStore.getState();
    expect(state.revealedFacts).toEqual(['seen-pod']);
    expect(state.stageIndex).toBe(0);
  });

  it('advances to the next stage and resets per-stage facts when the advancing command runs', () => {
    useSimStore.getState().startCampaign(testCampaign);
    useSimStore.getState().runCommand('look');
    useSimStore.getState().runCommand('act');
    const state = useSimStore.getState();
    expect(state.stageIndex).toBe(1);
    expect(state.revealedFacts).toEqual([]);
    expect(state.collectedFacts).toEqual(['seen-pod']);
    expect(state.clusterStatus).toBe('suspicious');
  });

  it('records unrecognized commands without changing stage or facts', () => {
    useSimStore.getState().startCampaign(testCampaign);
    useSimStore.getState().runCommand('nonsense');
    const state = useSimStore.getState();
    expect(state.stageIndex).toBe(0);
    expect(state.terminalHistory[0].output).toEqual(['Command not recognized in this context.']);
  });
});
