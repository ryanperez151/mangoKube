import { useState, useEffect } from 'react';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { parseCommand } from './terminalParser';
import type { Campaign, CampaignId, TerminalEntry } from '@/content/types';

interface SimState {
  campaign: Campaign | null;
  campaignId: CampaignId | null;
  stageIndex: number;
  revealedFacts: string[];
  collectedFacts: string[];
  terminalHistory: TerminalEntry[];
  clusterStatus: 'nominal' | 'suspicious' | 'compromised' | 'contained';
  highlightedNodeIds: string[];
  revealedEdgeIds: string[];
  startCampaign: (campaign: Campaign) => void;
  hydrateCampaign: (campaign: Campaign) => void;
  runCommand: (input: string) => void;
  resetProgress: () => void;
}

const initialTransientState = {
  stageIndex: 0,
  revealedFacts: [] as string[],
  collectedFacts: [] as string[],
  terminalHistory: [] as TerminalEntry[],
  clusterStatus: 'nominal' as const,
  highlightedNodeIds: [] as string[],
  revealedEdgeIds: [] as string[],
};

export const useSimStore = create<SimState>()(
  persist(
    (set, get) => ({
      campaign: null,
      campaignId: null,
      ...initialTransientState,

      startCampaign: (campaign) => {
        const firstStage = campaign.stages[0];
        set({
          campaign,
          campaignId: campaign.id,
          ...initialTransientState,
          clusterStatus: firstStage.clusterInitial.status ?? 'nominal',
          highlightedNodeIds: firstStage.clusterInitial.highlightNodeIds ?? [],
          revealedEdgeIds: firstStage.clusterInitial.revealEdgeIds ?? [],
        });
      },

      hydrateCampaign: (campaign) => set({ campaign }),

      runCommand: (input) => {
        const { campaign, stageIndex, revealedFacts, collectedFacts, terminalHistory } = get();
        if (!campaign) return;
        const stage = campaign.stages[stageIndex];
        const outcome = parseCommand(input, stage, new Set(revealedFacts));

        if (!outcome) {
          set({
            terminalHistory: [
              ...terminalHistory,
              { input, output: ['Command not recognized in this context.'] },
            ],
          });
          return;
        }

        const nextRevealedFacts = [
          ...new Set([...revealedFacts, ...(outcome.revealsFacts ?? [])]),
        ];
        const nextCollectedFacts = [
          ...new Set([...collectedFacts, ...(outcome.revealsFacts ?? [])]),
        ];
        const nextHistory = [...terminalHistory, { input, output: outcome.output }];

        if (outcome.advances) {
          const nextStageIndex = stageIndex + 1;
          const nextStage = campaign.stages[nextStageIndex];
          set({
            terminalHistory: nextHistory,
            collectedFacts: nextCollectedFacts,
            stageIndex: nextStageIndex,
            revealedFacts: [],
            clusterStatus:
              nextStage?.clusterInitial.status ?? outcome.clusterDelta?.status ?? get().clusterStatus,
            highlightedNodeIds:
              nextStage?.clusterInitial.highlightNodeIds ??
              outcome.clusterDelta?.highlightNodeIds ??
              get().highlightedNodeIds,
            revealedEdgeIds:
              nextStage?.clusterInitial.revealEdgeIds ??
              outcome.clusterDelta?.revealEdgeIds ??
              get().revealedEdgeIds,
          });
          return;
        }

        set({
          terminalHistory: nextHistory,
          revealedFacts: nextRevealedFacts,
          collectedFacts: nextCollectedFacts,
          clusterStatus: outcome.clusterDelta?.status ?? get().clusterStatus,
          highlightedNodeIds: outcome.clusterDelta?.highlightNodeIds
            ? [...new Set([...get().highlightedNodeIds, ...outcome.clusterDelta.highlightNodeIds])]
            : get().highlightedNodeIds,
          revealedEdgeIds: outcome.clusterDelta?.revealEdgeIds
            ? [...new Set([...get().revealedEdgeIds, ...outcome.clusterDelta.revealEdgeIds])]
            : get().revealedEdgeIds,
        });
      },

      resetProgress: () => set({ campaign: null, campaignId: null, ...initialTransientState }),
    }),
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
    setHasHydrated(useSimStore.persist?.hasHydrated() ?? true);
    const unsubscribe = useSimStore.persist?.onFinishHydration(() => setHasHydrated(true));
    return unsubscribe;
  }, []);

  return hasHydrated;
}
