import { createElement } from 'react';
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { useSimStore, useHasHydrated } from './store';
import { infiltratorCampaign } from '@/content/chapter1/infiltrator';
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

describe('persist hydration', () => {
  it('exposes a callable hasHydrated() on the persist API', () => {
    expect(typeof useSimStore.persist.hasHydrated).toBe('function');
    expect(typeof useSimStore.persist.hasHydrated()).toBe('boolean');
  });

  it('exposes a callable onFinishHydration() on the persist API', () => {
    expect(typeof useSimStore.persist.onFinishHydration).toBe('function');
  });

  it('useHasHydrated resolves to true once mounted in a browser-like (jsdom) environment', async () => {
    function Probe() {
      const hasHydrated = useHasHydrated();
      return createElement('span', null, hasHydrated ? 'hydrated' : 'pending');
    }

    render(createElement(Probe));

    await waitFor(() => {
      expect(screen.getByText('hydrated')).toBeInTheDocument();
    });
  });
});

describe('persisted state excludes non-serializable campaign content (regression)', () => {
  it('does not persist the campaign object (with its RegExp match fields) to localStorage, but does persist campaignId', () => {
    useSimStore.getState().startCampaign(infiltratorCampaign);

    const raw = localStorage.getItem('operation-mango-progress');
    expect(raw).not.toBeNull();
    const parsed = JSON.parse(raw as string);

    expect(parsed.state).not.toHaveProperty('campaign');
    expect(parsed.state.campaignId).toBe('infiltrator');
  });

  it('surviving a simulated reload (resetProgress + hydrateCampaign with live RegExp instances) does not throw when a command is run', () => {
    useSimStore.getState().startCampaign(infiltratorCampaign);
    expect(useSimStore.getState().campaignId).toBe('infiltrator');

    // Simulate what happens on a real page reload: the in-memory `campaign`
    // object is gone (only campaignId + progress survived JSON persistence),
    // and the page re-attaches a fresh campaign object from the content
    // registry (with real, working RegExp instances) via hydrateCampaign.
    useSimStore.setState({ campaign: null });
    expect(useSimStore.getState().campaign).toBeNull();

    useSimStore.getState().hydrateCampaign(infiltratorCampaign);
    expect(useSimStore.getState().campaign).toBe(infiltratorCampaign);

    // The stage-1 recon command should still match via a real RegExp .test(),
    // not throw "command.match.test is not a function".
    expect(() => useSimStore.getState().runCommand('kubectl get pods')).not.toThrow();

    const state = useSimStore.getState();
    expect(state.terminalHistory.at(-1)?.output).not.toEqual([
      'Command not recognized in this context.',
    ]);
    expect(state.revealedFacts).toContain('found-implant-pod');
  });
});
