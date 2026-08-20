import { createElement } from 'react';
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { useSimStore, useHasHydrated } from './store';
import { getPersistenceStatus, initialPersistedProgress, normalizePersistedProgress } from './persistence';
import { infiltratorCampaign } from '@/content/chapter1/infiltrator';
import { sentinelCampaign } from '@/content/chapter1/sentinel';
import type { Campaign } from '@/content/types';

const testCampaign: Campaign = {
  id: 'infiltrator',
  title: 'Test Campaign',
  tagline: '',
  terminalProfile: {
    prompt: 'root@test:/workspace$',
    banner: ['Test shell ready.'],
    ambientCommands: [
      {
        match: /^whoami$/i,
        description: 'whoami',
        outcome: { output: ['root'] },
      },
    ],
  },
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
      advanceWhen: { facts: ['later-fact'] },
    },
    {
      id: 'stage-3',
      title: 'Stage 3',
      briefing: [],
      objective: 'o3',
      clusterInitial: { status: 'compromised' },
      commands: [],
    },
  ],
  logCorpus: [
    {
      id: 'ev-a',
      timestamp: '2026-08-12T02:00:00Z',
      source: 'edr',
      message: 'suspicious thing',
      fields: { pod: 'p' },
      arrivesAtStage: 0,
      revealsFact: 'seen-pod',
      analystNote: 'note a',
    },
    {
      id: 'ev-benign',
      timestamp: '2026-08-12T02:05:00Z',
      source: 'edr',
      message: 'routine thing',
      fields: { pod: 'p' },
      arrivesAtStage: 0,
      analystNote: 'nothing to see',
    },
    {
      id: 'ev-late',
      timestamp: '2026-08-12T02:06:00Z',
      source: 'edr',
      message: 'later thing',
      fields: { pod: 'p' },
      arrivesAtStage: 1,
      revealsFact: 'later-fact',
      analystNote: 'note late',
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

  it('holds completed work at a pending resolution until the player continues', () => {
    useSimStore.getState().startCampaign(testCampaign);
    useSimStore.getState().runCommand('look');
    useSimStore.getState().runCommand('act');
    const state = useSimStore.getState();
    expect(state.stageIndex).toBe(0);
    expect(state.pendingStageResolution).toEqual({ stageId: 'stage-1' });
    expect(state.revealedFacts).toEqual(['seen-pod']);
    expect(state.collectedFacts).toEqual(['seen-pod']);
    expect(state.clusterStatus).toBe('suspicious');

    useSimStore.getState().setQuery('source=edr');
    useSimStore.getState().continueFromResolution();
    expect(useSimStore.getState().stageIndex).toBe(1);
    expect(useSimStore.getState().pendingStageResolution).toBeNull();
    expect(useSimStore.getState().revealedFacts).toEqual([]);
    expect(useSimStore.getState().activeQuery).toBe('');
  });

  it('records unrecognized commands without changing stage or facts', () => {
    useSimStore.getState().startCampaign(testCampaign);
    useSimStore.getState().runCommand('nonsense');
    const state = useSimStore.getState();
    expect(state.stageIndex).toBe(0);
    expect(state.terminalHistory[0].output).toEqual(['Command not recognized in this context.']);
  });

  it('runs an ambient command without progressing or escalating guidance', () => {
    useSimStore.getState().startCampaign(testCampaign);
    useSimStore.getState().runCommand('whoami');

    const state = useSimStore.getState();
    expect(state.terminalHistory).toEqual([{ input: 'whoami', output: ['root'] }]);
    expect(state.stageIndex).toBe(0);
    expect(state.collectedFacts).toEqual([]);
    expect(state.pendingStageResolution).toBeNull();
    expect(state.failedAttemptsByStage).toEqual({});
    expect(state.guidanceLevelByStage).toEqual({});
  });

  it('does not let an ambient command reconcile an already-complete recovered stage', () => {
    useSimStore.getState().startCampaign(testCampaign);
    useSimStore.setState({
      stageIndex: 1,
      collectedFacts: ['later-fact'],
      revealedFacts: ['later-fact'],
      pendingStageResolution: null,
    });

    useSimStore.getState().runCommand('whoami');

    const state = useSimStore.getState();
    expect(state.terminalHistory.at(-1)).toEqual({ input: 'whoami', output: ['root'] });
    expect(state.pendingStageResolution).toBeNull();
    expect(state.stageIndex).toBe(1);
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

describe('evidence pinning', () => {
  it('reveals a fact when a signal event is pinned', () => {
    useSimStore.getState().startCampaign(testCampaign);
    useSimStore.getState().pinEvent('ev-a');
    const state = useSimStore.getState();
    expect(state.pinnedEvidence).toEqual(['ev-a']);
    expect(state.collectedFacts).toEqual(['seen-pod']);
  });

  it('pins a benign event without revealing anything or advancing', () => {
    useSimStore.getState().startCampaign(testCampaign);
    useSimStore.getState().pinEvent('ev-benign');
    const state = useSimStore.getState();
    expect(state.pinnedEvidence).toEqual(['ev-benign']);
    expect(state.collectedFacts).toEqual([]);
    expect(state.stageIndex).toBe(0);
  });

  it('ignores a pin for an event that has not arrived yet', () => {
    useSimStore.getState().startCampaign(testCampaign);
    useSimStore.getState().pinEvent('ev-late');
    expect(useSimStore.getState().pinnedEvidence).toEqual([]);
  });

  it('does not double-pin the same event', () => {
    useSimStore.getState().startCampaign(testCampaign);
    useSimStore.getState().pinEvent('ev-a');
    useSimStore.getState().pinEvent('ev-a');
    expect(useSimStore.getState().pinnedEvidence).toEqual(['ev-a']);
  });

  it('unpins an event without retracting the fact it established', () => {
    useSimStore.getState().startCampaign(testCampaign);
    useSimStore.getState().pinEvent('ev-a');
    useSimStore.getState().unpinEvent('ev-a');
    const state = useSimStore.getState();
    expect(state.pinnedEvidence).toEqual([]);
    expect(state.collectedFacts).toEqual(['seen-pod']);
  });

  it('advances the stage when a pin satisfies advanceWhen', () => {
    useSimStore.getState().startCampaign(testCampaign);
    useSimStore.getState().runCommand('look');
    useSimStore.getState().runCommand('act');
    useSimStore.getState().continueFromResolution();
    expect(useSimStore.getState().stageIndex).toBe(1);
    // 'ev-late' has now arrived (arrivesAtStage 1) and reveals the fact
    // stage-2's advanceWhen requires.
    useSimStore.getState().pinEvent('ev-late');
    expect(useSimStore.getState().stageIndex).toBe(1);
    expect(useSimStore.getState().pendingStageResolution).toEqual({ stageId: 'stage-2' });
    useSimStore.getState().continueFromResolution();
    expect(useSimStore.getState().stageIndex).toBe(2);
  });
});

describe('query state', () => {
  it('stores the active query and time range', () => {
    useSimStore.getState().startCampaign(testCampaign);
    useSimStore.getState().setQuery('source=edr');
    useSimStore.getState().setTimeRange('all-time');
    const state = useSimStore.getState();
    expect(state.activeQuery).toBe('source=edr');
    expect(state.timeRangeId).toBe('all-time');
  });

  it('clears query and pinned evidence when a campaign starts', () => {
    useSimStore.getState().startCampaign(testCampaign);
    useSimStore.getState().setQuery('source=edr');
    useSimStore.getState().pinEvent('ev-a');
    useSimStore.getState().startCampaign(testCampaign);
    const state = useSimStore.getState();
    expect(state.activeQuery).toBe('');
    expect(state.pinnedEvidence).toEqual([]);
  });
});

describe('campaign progression contracts', () => {
  it('records a valid decision effect and ignores unknown decision options', () => {
    const campaign: Campaign = {
      ...testCampaign,
      stages: [
        {
          ...testCampaign.stages[0],
          decision: {
            id: 'containment',
            timing: 'before-stage',
            prompt: 'When?',
            options: [
              {
                id: 'contain-now',
                label: 'Contain now',
                description: 'Stop the breach.',
                effects: {
                  revealsFacts: ['binding-revoked'],
                  clusterDelta: { status: 'contained', highlightNodeIds: ['binding'] },
                },
              },
            ],
          },
        },
        {
          ...testCampaign.stages[1],
          decision: {
            id: 'future-decision',
            timing: 'before-stage',
            prompt: 'Later?',
            options: [{ id: 'later', label: 'Later', description: 'Not yet.' }],
          },
        },
        ...testCampaign.stages.slice(2),
      ],
    };
    useSimStore.getState().startCampaign(campaign);

    useSimStore.getState().chooseDecision('unknown', 'nope');
    useSimStore.getState().chooseDecision('containment', 'nope');
    useSimStore.getState().chooseDecision('future-decision', 'later');
    expect(useSimStore.getState().decisions).toEqual({});

    useSimStore.getState().chooseDecision('containment', 'contain-now');
    const state = useSimStore.getState();
    expect(state.decisions).toEqual({ containment: 'contain-now' });
    expect(state.collectedFacts).toContain('binding-revoked');
    expect(state.clusterStatus).toBe('contained');
    expect(state.highlightedNodeIds).toContain('binding');
  });

  it('walks the guidance tiers one step per explicit request, stopping at the exact answer', () => {
    useSimStore.getState().startCampaign(testCampaign);
    useSimStore.getState().requestGuidance();
    expect(useSimStore.getState().guidanceLevelByStage).toEqual({ 'stage-1': 1 });

    useSimStore.getState().requestGuidance();
    expect(useSimStore.getState().guidanceLevelByStage).toEqual({ 'stage-1': 2 });

    useSimStore.getState().requestGuidance();
    useSimStore.getState().requestGuidance();
    expect(useSimStore.getState().guidanceLevelByStage).toEqual({ 'stage-1': 3 });
  });

  it('unlocks guidance after unsuccessful streaks and retains it after success', () => {
    useSimStore.getState().startCampaign(testCampaign);

    useSimStore.getState().recordAttempt(false);
    useSimStore.getState().recordAttempt(false);
    expect(useSimStore.getState().guidanceLevelByStage).toEqual({ 'stage-1': 1 });

    useSimStore.getState().recordAttempt(false);
    useSimStore.getState().recordAttempt(false);
    expect(useSimStore.getState().guidanceLevelByStage).toEqual({ 'stage-1': 2 });

    useSimStore.getState().recordAttempt(false);
    useSimStore.getState().recordAttempt(false);
    useSimStore.getState().recordAttempt(true);
    expect(useSimStore.getState().failedAttemptsByStage).toEqual({ 'stage-1': 0 });
    expect(useSimStore.getState().guidanceLevelByStage).toEqual({ 'stage-1': 3 });
  });

  it('keeps the primer marked as read across a replay but not across a reset', () => {
    useSimStore.getState().startCampaign(testCampaign);
    useSimStore.getState().markPrimerSeen('sentinel');
    useSimStore.getState().markPrimerSeen('sentinel');
    expect(useSimStore.getState().seenPrimerIds).toEqual(['sentinel']);

    useSimStore.getState().startCampaign(testCampaign);
    expect(useSimStore.getState().seenPrimerIds).toEqual(['sentinel']);

    useSimStore.getState().resetProgress();
    expect(useSimStore.getState().seenPrimerIds).toEqual([]);
  });

  it('marks a briefing once without duplication', () => {
    useSimStore.getState().startCampaign(testCampaign);
    useSimStore.getState().markBriefingSeen('stage-1');
    useSimStore.getState().markBriefingSeen('stage-1');
    expect(useSimStore.getState().seenBriefingIds).toEqual(['stage-1']);
  });

  it('keeps a before-stage decision immutable after stage completion is pending', () => {
    const campaign: Campaign = {
      ...testCampaign,
      stages: [
        {
          ...testCampaign.stages[0],
          decision: {
            id: 'containment',
            timing: 'before-stage',
            prompt: 'When?',
            options: [
              { id: 'hunt-first', label: 'Hunt first', description: 'Gather evidence.' },
              {
                id: 'contain-now',
                label: 'Contain now',
                description: 'Act immediately.',
                effects: { revealsFacts: ['late-decision-fact'] },
              },
            ],
          },
        },
        ...testCampaign.stages.slice(1),
      ],
    };
    useSimStore.getState().startCampaign(campaign);
    useSimStore.getState().chooseDecision('containment', 'hunt-first');
    useSimStore.getState().runCommand('look');
    useSimStore.getState().runCommand('act');

    expect(useSimStore.getState().pendingStageResolution).toEqual({ stageId: 'stage-1' });
    useSimStore.getState().chooseDecision('containment', 'contain-now');
    expect(useSimStore.getState().decisions).toEqual({ containment: 'hunt-first' });
    expect(useSimStore.getState().collectedFacts).not.toContain('late-decision-fact');
  });

  it('allows one after-stage decision while completion is pending and then locks it', () => {
    const campaign: Campaign = {
      ...testCampaign,
      stages: [
        {
          ...testCampaign.stages[0],
          decision: {
            id: 'containment',
            timing: 'after-stage',
            prompt: 'When?',
            options: [
              { id: 'hunt-first', label: 'Hunt first', description: 'Gather evidence.' },
              {
                id: 'contain-now',
                label: 'Contain now',
                description: 'Act immediately.',
                effects: { revealsFacts: ['binding-revoked'] },
              },
            ],
          },
        },
        ...testCampaign.stages.slice(1),
      ],
    };
    useSimStore.getState().startCampaign(campaign);
    useSimStore.getState().runCommand('look');
    useSimStore.getState().runCommand('act');

    expect(useSimStore.getState().pendingStageResolution).toEqual({ stageId: 'stage-1' });
    useSimStore.getState().chooseDecision('containment', 'contain-now');
    expect(useSimStore.getState().decisions).toEqual({ containment: 'contain-now' });
    expect(useSimStore.getState().collectedFacts).toContain('binding-revoked');

    useSimStore.getState().chooseDecision('containment', 'hunt-first');
    expect(useSimStore.getState().decisions).toEqual({ containment: 'contain-now' });
  });
});

describe('persist migration', () => {
  it.each([
    ['a missing selection', {}],
    ['an invalid selection', { 'operational-order': 'not-an-option' }],
  ] as const)(
    'defaults %s when pending Escalation proves the before-stage decision was crossed',
    (_label, decisions) => {
      const normalized = normalizePersistedProgress({
        ...initialPersistedProgress,
        campaignId: 'infiltrator',
        stageIndex: 3,
        decisions,
        pendingStageResolution: { stageId: 'escalation' },
      });

      expect(normalized.progress.decisions).toEqual({ 'operational-order': 'exfil-first' });
      expect(normalized.progress.pendingStageResolution).toEqual({ stageId: 'escalation' });
      expect(normalized.issue).toBe('recovered');
    }
  );

  it('keeps the current before-stage decision open when no resolution is pending', () => {
    const normalized = normalizePersistedProgress({
      ...initialPersistedProgress,
      campaignId: 'infiltrator',
      stageIndex: 3,
      decisions: { 'operational-order': 'not-an-option' },
    });

    expect(normalized.progress.decisions).toEqual({});
    expect(normalized.progress.pendingStageResolution).toBeNull();
    expect(normalized.issue).toBe('recovered');
  });

  it('rehydrates pending Escalation with a playable explicit route default', async () => {
    localStorage.setItem(
      'operation-mango-progress',
      JSON.stringify({
        state: {
          ...initialPersistedProgress,
          campaignId: 'infiltrator',
          stageIndex: 3,
          pendingStageResolution: { stageId: 'escalation' },
        },
        version: 2,
      })
    );

    await useSimStore.persist.rehydrate();

    expect(useSimStore.getState().decisions).toEqual({ 'operational-order': 'exfil-first' });
    expect(useSimStore.getState().pendingStageResolution).toEqual({ stageId: 'escalation' });
    expect(getPersistenceStatus().kind).toBe('recovered');
  });

  it('treats an absent storage key as a clean no-save', async () => {
    expect(localStorage.getItem('operation-mango-progress')).toBeNull();

    await useSimStore.persist.rehydrate();

    expect(useSimStore.getState().campaignId).toBeNull();
    expect(useSimStore.getState().stageIndex).toBe(0);
    expect(getPersistenceStatus().kind).toBe('ready');
  });

  it('discards a pre-rework Sentinel save', () => {
    localStorage.setItem(
      'operation-mango-progress',
      JSON.stringify({
        state: { campaignId: 'sentinel', stageIndex: 3, collectedFacts: ['found-binding'] },
        version: 0,
      })
    );

    useSimStore.persist.rehydrate();

    const state = useSimStore.getState();
    expect(state.campaignId).toBeNull();
    expect(state.collectedFacts).toEqual([]);
  });

  it('adds v2 defaults and route defaults when a v1 save has crossed each decision point', () => {
    localStorage.setItem(
      'operation-mango-progress',
      JSON.stringify({
        state: { campaignId: 'infiltrator', stageIndex: 4 },
        version: 1,
      })
    );
    useSimStore.persist.rehydrate();
    expect(useSimStore.getState().decisions).toEqual({ 'operational-order': 'exfil-first' });
    expect(useSimStore.getState().pendingStageResolution).toBeNull();
  });

  it.each([
    ['sentinel', 2, {}],
    ['sentinel', 3, { 'containment-timing': 'hunt-first' }],
    ['sentinel', 4, { 'containment-timing': 'hunt-first' }],
    ['infiltrator', 3, {}],
    ['infiltrator', 4, { 'operational-order': 'exfil-first' }],
  ] as const)(
    'defaults %s only after its decision point (stage %i)',
    (campaignId, stageIndex, expectedDecisions) => {
      useSimStore.getState().resetProgress();
      localStorage.setItem(
        'operation-mango-progress',
        JSON.stringify({ state: { campaignId, stageIndex }, version: 1 })
      );

      useSimStore.persist.rehydrate();
      expect(useSimStore.getState().decisions).toEqual(expectedDecisions);
    }
  );

  it('normalizes recoverable known progress instead of hydrating unsafe values', async () => {
    localStorage.setItem(
      'operation-mango-progress',
      JSON.stringify({
        state: {
          campaignId: 'sentinel',
          stageIndex: 999,
          collectedFacts: ['evidence-interactive-shell', 'not-a-fact'],
          revealedFacts: 'not-an-array',
          decisions: { 'containment-timing': 'not-an-option', unknown: 'value' },
          pendingStageResolution: { stageId: 'not-a-stage' },
        },
        version: 2,
      })
    );

    await useSimStore.persist.rehydrate();

    const state = useSimStore.getState();
    expect(state.campaignId).toBe('sentinel');
    expect(state.stageIndex).toBe(sentinelCampaign.stages.length);
    expect(state.collectedFacts).toEqual(['evidence-interactive-shell']);
    expect(state.revealedFacts).toEqual([]);
    expect(state.decisions).toEqual({ 'containment-timing': 'hunt-first' });
    expect(state.pendingStageResolution).toBeNull();
  });

  it('repairs an invalid decision after its stage so the resumed route remains playable', async () => {
    localStorage.setItem(
      'operation-mango-progress',
      JSON.stringify({
        state: {
          campaignId: 'sentinel',
          stageIndex: 4,
          decisions: { 'containment-timing': 'not-an-option' },
        },
        version: 2,
      })
    );

    await useSimStore.persist.rehydrate();

    expect(useSimStore.getState().decisions).toEqual({ 'containment-timing': 'hunt-first' });
  });

  it('repairs progressed Infiltrator saves to exfil-first independently of option order', async () => {
    const decision = infiltratorCampaign.stages[3].decision!;
    const originalOptions = decision.options;
    decision.options = [...originalOptions].reverse();
    try {
      localStorage.setItem(
        'operation-mango-progress',
        JSON.stringify({
          state: {
            campaignId: 'infiltrator',
            stageIndex: 4,
            decisions: { 'operational-order': 'not-an-option' },
          },
          version: 2,
        })
      );

      await useSimStore.persist.rehydrate();

      expect(useSimStore.getState().decisions).toEqual({ 'operational-order': 'exfil-first' });
    } finally {
      decision.options = originalOptions;
    }
  });

  it('reports recovery when malformed history and diagram ids are removed', async () => {
    localStorage.setItem(
      'operation-mango-progress',
      JSON.stringify({
        state: {
          ...initialPersistedProgress,
          campaignId: 'infiltrator',
          terminalHistory: [{ input: 42, output: ['invalid'] }],
          highlightedNodeIds: ['ci-deploy-bot', 'unknown-node'],
          revealedEdgeIds: ['unknown-edge'],
        },
        version: 2,
      })
    );

    await useSimStore.persist.rehydrate();

    expect(useSimStore.getState().terminalHistory).toEqual([]);
    expect(useSimStore.getState().highlightedNodeIds).toEqual(['ci-deploy-bot']);
    expect(useSimStore.getState().revealedEdgeIds).toEqual([]);
    expect(getPersistenceStatus().kind).toBe('recovered');
  });

  it.each([
    null,
    [],
    'invalid-state',
    42,
    true,
    {},
  ])('reports a supplied non-object or empty progress state as corrupt: %j', async (persistedState) => {
    localStorage.setItem(
      'operation-mango-progress',
      JSON.stringify({ state: persistedState, version: 2 })
    );

    await useSimStore.persist.rehydrate();

    expect(useSimStore.getState().campaignId).toBeNull();
    expect(useSimStore.getState().stageIndex).toBe(0);
    expect(getPersistenceStatus().kind).toBe('corrupt');
  });

  it.each([
    ['null', 'null'],
    ['array', '[]'],
    ['number', '42'],
    ['empty object', '{}'],
  ])('reports raw top-level %s JSON as corrupt before Zustand unwraps it', async (_label, raw) => {
    localStorage.setItem('operation-mango-progress', raw);

    await useSimStore.persist.rehydrate();

    expect(useSimStore.getState().campaignId).toBeNull();
    expect(getPersistenceStatus().kind).toBe('corrupt');
  });

  it('reports null-campaign progress with incompatible data as corrupt', async () => {
    localStorage.setItem(
      'operation-mango-progress',
      JSON.stringify({
        state: { ...initialPersistedProgress, stageIndex: 3 },
        version: 2,
      })
    );

    await useSimStore.persist.rehydrate();

    expect(useSimStore.getState().campaignId).toBeNull();
    expect(useSimStore.getState().stageIndex).toBe(0);
    expect(getPersistenceStatus().kind).toBe('corrupt');
  });

  it('accepts only the canonical empty progress state as a clean no-save', async () => {
    localStorage.setItem(
      'operation-mango-progress',
      JSON.stringify({ state: initialPersistedProgress, version: 2 })
    );

    await useSimStore.persist.rehydrate();

    expect(useSimStore.getState().campaignId).toBeNull();
    expect(getPersistenceStatus().kind).toBe('ready');
  });

  it('treats a save written before seenPrimerIds existed as clean, not corrupt', async () => {
    const { seenPrimerIds: _omitted, ...beforePrimer } = initialPersistedProgress;
    localStorage.setItem(
      'operation-mango-progress',
      JSON.stringify({ state: beforePrimer, version: 2 })
    );

    await useSimStore.persist.rehydrate();

    expect(useSimStore.getState().campaignId).toBeNull();
    expect(useSimStore.getState().seenPrimerIds).toEqual([]);
    expect(getPersistenceStatus().kind).toBe('ready');
  });

  it('keeps in-progress work from a save written before seenPrimerIds existed', async () => {
    const { seenPrimerIds: _omitted, ...beforePrimer } = initialPersistedProgress;
    localStorage.setItem(
      'operation-mango-progress',
      JSON.stringify({
        state: { ...beforePrimer, campaignId: 'sentinel', stageIndex: 2, seenBriefingIds: ['triage'] },
        version: 2,
      })
    );

    await useSimStore.persist.rehydrate();

    expect(useSimStore.getState().campaignId).toBe('sentinel');
    expect(useSimStore.getState().stageIndex).toBe(2);
    expect(useSimStore.getState().seenPrimerIds).toEqual([]);
    expect(getPersistenceStatus().kind).toBe('ready');
  });

  it('discards an incompatible campaign id without throwing', async () => {
    localStorage.setItem(
      'operation-mango-progress',
      JSON.stringify({ state: { campaignId: 'unknown-role', stageIndex: 2 }, version: 2 })
    );

    await expect(useSimStore.persist.rehydrate()).resolves.not.toThrow();
    expect(useSimStore.getState().campaignId).toBeNull();
    expect(useSimStore.getState().stageIndex).toBe(0);
  });

  it('continues in memory when persist writes are unavailable', () => {
    const setItem = Storage.prototype.setItem;
    Storage.prototype.setItem = () => {
      throw new DOMException('denied', 'SecurityError');
    };

    try {
      expect(() => useSimStore.getState().startCampaign(testCampaign)).not.toThrow();
      expect(useSimStore.getState().campaignId).toBe('infiltrator');
    } finally {
      Storage.prototype.setItem = setItem;
    }
  });
});

describe('advanceWhen cascade', () => {
  it('cascades past a stage whose advanceWhen facts are already collected', () => {
    const campaign: Campaign = {
      ...testCampaign,
      stages: [
        {
          id: 'a',
          title: 'A',
          briefing: [],
          objective: 'o',
          clusterInitial: { status: 'nominal' },
          commands: [
            {
              match: /^go$/,
              description: 'go',
              outcome: { output: [], revealsFacts: ['shared'], advances: true },
            },
          ],
        },
        {
          id: 'b',
          title: 'B',
          briefing: [],
          objective: 'o',
          clusterInitial: { status: 'suspicious' },
          commands: [],
          advanceWhen: { facts: ['shared'] },
        },
        {
          id: 'c',
          title: 'C',
          briefing: [],
          objective: 'o',
          clusterInitial: { status: 'compromised' },
          commands: [],
        },
      ],
    };

    useSimStore.getState().startCampaign(campaign);
    useSimStore.getState().runCommand('go');
    useSimStore.getState().continueFromResolution();

    // Stage b's advanceWhen was already satisfied on entry, so it gets its
    // own resolution instead of stalling and can then be explicitly continued.
    expect(useSimStore.getState().stageIndex).toBe(1);
    expect(useSimStore.getState().pendingStageResolution).toEqual({ stageId: 'b' });
    useSimStore.getState().continueFromResolution();
    expect(useSimStore.getState().stageIndex).toBe(2);
  });
});

describe('cluster visuals across stage advance', () => {
  it('carries highlights forward when the next stage sets none of its own', () => {
    const campaign: Campaign = {
      ...testCampaign,
      stages: [
        {
          id: 'a',
          title: 'A',
          briefing: [],
          objective: 'o',
          clusterInitial: { status: 'nominal', highlightNodeIds: ['n1'], revealEdgeIds: ['e1'] },
          commands: [
            {
              match: /^go$/,
              description: 'go',
              outcome: { output: [], advances: true, clusterDelta: { status: 'compromised' } },
            },
          ],
        },
        {
          id: 'b',
          title: 'B',
          briefing: [],
          objective: 'o',
          clusterInitial: { status: 'compromised' },
          commands: [],
        },
      ],
    };

    useSimStore.getState().startCampaign(campaign);
    useSimStore.getState().runCommand('go');
    useSimStore.getState().continueFromResolution();

    const state = useSimStore.getState();
    expect(state.stageIndex).toBe(1);
    expect(state.clusterStatus).toBe('compromised');
    expect(state.highlightedNodeIds).toEqual(['n1']);
    expect(state.revealedEdgeIds).toEqual(['e1']);
  });
});
