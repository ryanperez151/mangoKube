import { useState, useEffect } from 'react';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { parseCommand } from './terminalParser';
import type { Campaign, CampaignId, ClusterDelta, TerminalEntry } from '@/content/types';

type ClusterStatus = 'nominal' | 'suspicious' | 'compromised' | 'contained';

interface SimState {
  campaign: Campaign | null;
  campaignId: CampaignId | null;
  stageIndex: number;
  revealedFacts: string[];
  collectedFacts: string[];
  terminalHistory: TerminalEntry[];
  clusterStatus: ClusterStatus;
  highlightedNodeIds: string[];
  revealedEdgeIds: string[];
  pinnedEvidence: string[];
  activeQuery: string;
  timeRangeId: string;
  startCampaign: (campaign: Campaign) => void;
  hydrateCampaign: (campaign: Campaign) => void;
  runCommand: (input: string) => void;
  pinEvent: (eventId: string) => void;
  unpinEvent: (eventId: string) => void;
  setQuery: (query: string) => void;
  setTimeRange: (rangeId: string) => void;
  resetProgress: () => void;
}

const initialTransientState = {
  stageIndex: 0,
  revealedFacts: [] as string[],
  collectedFacts: [] as string[],
  terminalHistory: [] as TerminalEntry[],
  clusterStatus: 'nominal' as ClusterStatus,
  highlightedNodeIds: [] as string[],
  revealedEdgeIds: [] as string[],
  pinnedEvidence: [] as string[],
  activeQuery: '',
  timeRangeId: 'last-1h',
};

/**
 * The cluster-visual patch applied when a campaign starts on its first
 * stage. A fresh campaign has nothing accumulated yet, so absent id arrays
 * correctly resolve to `[]` here — this is NOT used for stage-to-stage
 * advance, where prior highlights/edges must persist (see the advance
 * branch of `applyReveal`).
 */
function enterStagePatch(delta: ClusterDelta | undefined, fallback: ClusterStatus) {
  return {
    clusterStatus: delta?.status ?? fallback,
    highlightedNodeIds: delta?.highlightNodeIds ?? [],
    revealedEdgeIds: delta?.revealEdgeIds ?? [],
  };
}

export const useSimStore = create<SimState>()(
  persist(
    (set, get) => {
      /**
       * The single place facts are added and stage completion is judged.
       * Both the terminal and evidence pinning route through here, so the
       * two surfaces can never disagree about when a stage is over.
       */
      function applyReveal(
        factIds: string[],
        extra: Partial<SimState>,
        forceAdvance: boolean,
        delta?: ClusterDelta
      ): void {
        const state = get();
        const { campaign, stageIndex } = state;
        if (!campaign) return;

        const collectedFacts = [...new Set([...state.collectedFacts, ...factIds])];
        const revealedFacts = [...new Set([...state.revealedFacts, ...factIds])];

        const stage = campaign.stages[stageIndex];
        const required = stage?.advanceWhen?.facts ?? [];
        const advanceWhenMet =
          required.length > 0 && required.every((factId) => collectedFacts.includes(factId));

        if (forceAdvance || advanceWhenMet) {
          const nextStage = campaign.stages[stageIndex + 1];
          set({
            ...extra,
            collectedFacts,
            revealedFacts: [],
            stageIndex: stageIndex + 1,
            clusterStatus:
              nextStage?.clusterInitial.status ?? delta?.status ?? state.clusterStatus,
            highlightedNodeIds:
              nextStage?.clusterInitial.highlightNodeIds ??
              delta?.highlightNodeIds ??
              state.highlightedNodeIds,
            revealedEdgeIds:
              nextStage?.clusterInitial.revealEdgeIds ??
              delta?.revealEdgeIds ??
              state.revealedEdgeIds,
          });
          return;
        }

        set({
          ...extra,
          collectedFacts,
          revealedFacts,
          clusterStatus: delta?.status ?? state.clusterStatus,
          highlightedNodeIds: delta?.highlightNodeIds
            ? [...new Set([...state.highlightedNodeIds, ...delta.highlightNodeIds])]
            : state.highlightedNodeIds,
          revealedEdgeIds: delta?.revealEdgeIds
            ? [...new Set([...state.revealedEdgeIds, ...delta.revealEdgeIds])]
            : state.revealedEdgeIds,
        });
      }

      return {
        campaign: null,
        campaignId: null,
        ...initialTransientState,

        startCampaign: (campaign) => {
          const firstStage = campaign.stages[0];
          set({
            campaign,
            campaignId: campaign.id,
            ...initialTransientState,
            ...enterStagePatch(firstStage.clusterInitial, 'nominal'),
          });
        },

        hydrateCampaign: (campaign) => set({ campaign }),

        runCommand: (input) => {
          const state = get();
          if (!state.campaign) return;
          const stage = state.campaign.stages[state.stageIndex];
          const outcome = parseCommand(input, stage, new Set(state.revealedFacts));

          if (!outcome) {
            set({
              terminalHistory: [
                ...state.terminalHistory,
                { input, output: ['Command not recognized in this context.'] },
              ],
            });
            return;
          }

          applyReveal(
            outcome.revealsFacts ?? [],
            { terminalHistory: [...state.terminalHistory, { input, output: outcome.output }] },
            outcome.advances === true,
            outcome.clusterDelta
          );
        },

        pinEvent: (eventId) => {
          const state = get();
          const event = state.campaign?.logCorpus?.find((candidate) => candidate.id === eventId);
          if (!event) return;
          if (event.arrivesAtStage > state.stageIndex) return;
          if (state.pinnedEvidence.includes(eventId)) return;

          applyReveal(
            event.revealsFact ? [event.revealsFact] : [],
            { pinnedEvidence: [...state.pinnedEvidence, eventId] },
            false,
            undefined
          );
        },

        /**
         * Unpinning removes the card from the case file but never retracts
         * an established fact — you cannot un-know that the shell ran.
         */
        unpinEvent: (eventId) =>
          set({
            pinnedEvidence: get().pinnedEvidence.filter((pinned) => pinned !== eventId),
          }),

        setQuery: (query) => set({ activeQuery: query }),

        setTimeRange: (rangeId) => set({ timeRangeId: rangeId }),

        resetProgress: () => set({ campaign: null, campaignId: null, ...initialTransientState }),
      };
    },
    {
      name: 'operation-mango-progress',
      partialize: (state) => ({
        campaignId: state.campaignId,
        stageIndex: state.stageIndex,
        revealedFacts: state.revealedFacts,
        collectedFacts: state.collectedFacts,
        terminalHistory: state.terminalHistory,
        clusterStatus: state.clusterStatus,
        highlightedNodeIds: state.highlightedNodeIds,
        revealedEdgeIds: state.revealedEdgeIds,
        pinnedEvidence: state.pinnedEvidence,
        activeQuery: state.activeQuery,
        timeRangeId: state.timeRangeId,
      }),
    }
  )
);

export function useHasHydrated(): boolean {
  // `persist` is only attached to the store API once its storage backend
  // (localStorage) is successfully accessed. During `next build`'s static
  // export prerendering (Node, no `window`/`localStorage`), that access
  // throws and `useSimStore.persist` stays undefined — guard against that
  // so the build doesn't crash; in a real browser this is always defined.
  const [hasHydrated, setHasHydrated] = useState(
    () => useSimStore.persist?.hasHydrated() ?? false
  );

  useEffect(() => {
    // Same `?? false` fallback as the initializer above (this previously
    // read `?? true`, an inconsistency with no functional effect in a real
    // browser, where `.persist` is always defined by the time this effect
    // runs — corrected for consistency, not because it was load-bearing
    // for any observed bug).
    setHasHydrated(useSimStore.persist?.hasHydrated() ?? false);
    const unsubscribe = useSimStore.persist?.onFinishHydration(() => setHasHydrated(true));
    return unsubscribe;
  }, []);

  return hasHydrated;
}
