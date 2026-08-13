import { useState, useEffect } from 'react';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { parseCommand } from './terminalParser';
import { isChoiceVisible } from './conditions';
import {
  clearRecoverablePersistenceIssue,
  initialPersistedProgress,
  normalizePersistedProgress,
  reportNormalization,
  resilientStorage,
} from './persistence';
import type {
  Campaign,
  CampaignId,
  ClusterDelta,
  GuidanceLevel,
  PendingStageResolution,
  TerminalEntry,
} from '@/content/types';

type ClusterStatus = 'nominal' | 'suspicious' | 'compromised' | 'contained';

/**
 * The shape written to storage by `partialize` below — kept as an explicit
 * type so `migrate` can describe what it receives/returns without `any`.
 */
interface PersistedProgress {
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
  decisions: Record<string, string>;
  guidanceLevelByStage: Record<string, GuidanceLevel>;
  failedAttemptsByStage: Record<string, number>;
  seenBriefingIds: string[];
  pendingStageResolution: PendingStageResolution | null;
}

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
  decisions: Record<string, string>;
  guidanceLevelByStage: Record<string, GuidanceLevel>;
  failedAttemptsByStage: Record<string, number>;
  seenBriefingIds: string[];
  pendingStageResolution: PendingStageResolution | null;
  startCampaign: (campaign: Campaign) => void;
  hydrateCampaign: (campaign: Campaign) => void;
  runCommand: (input: string) => void;
  pinEvent: (eventId: string) => void;
  unpinEvent: (eventId: string) => void;
  setQuery: (query: string) => void;
  setTimeRange: (rangeId: string) => void;
  chooseDecision: (decisionId: string, optionId: string) => void;
  requestGuidance: () => void;
  recordAttempt: (successful: boolean) => void;
  markBriefingSeen: (briefingId: string) => void;
  continueFromResolution: () => void;
  resetProgress: () => void;
}

const { campaignId: _initialCampaignId, ...initialTransientState } = initialPersistedProgress;

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
      function updateAttempt(successful: boolean): void {
        const state = get();
        const stageId = state.campaign?.stages[state.stageIndex]?.id;
        if (!stageId) return;
        const failedAttempts = successful ? 0 : (state.failedAttemptsByStage[stageId] ?? 0) + 1;
        const unlocked = failedAttempts >= 4 ? 3 : failedAttempts >= 2 ? 2 : 0;
        set({
          failedAttemptsByStage: { ...state.failedAttemptsByStage, [stageId]: failedAttempts },
          guidanceLevelByStage:
            unlocked > 0
              ? {
                  ...state.guidanceLevelByStage,
                  [stageId]: Math.max(state.guidanceLevelByStage[stageId] ?? 0, unlocked) as GuidanceLevel,
                }
              : state.guidanceLevelByStage,
        });
      }

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
          set({
            ...extra,
            collectedFacts,
            revealedFacts,
            pendingStageResolution: { stageId: stage.id },
            clusterStatus: delta?.status ?? state.clusterStatus,
            highlightedNodeIds: delta?.highlightNodeIds
              ? [...new Set([...state.highlightedNodeIds, ...delta.highlightNodeIds])]
              : state.highlightedNodeIds,
            revealedEdgeIds: delta?.revealEdgeIds
              ? [...new Set([...state.revealedEdgeIds, ...delta.revealEdgeIds])]
              : state.revealedEdgeIds,
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
            timeRangeId: campaign.timeRanges?.[0]?.id ?? 'last-1h',
            ...enterStagePatch(firstStage.clusterInitial, 'nominal'),
          });
        },

        hydrateCampaign: (campaign) => set({ campaign }),

        runCommand: (input) => {
          const state = get();
          if (!state.campaign) return;
          const stage = state.campaign.stages[state.stageIndex];
          if (state.pendingStageResolution) return;
          const outcome = parseCommand(input, stage, new Set(state.revealedFacts), state.decisions);

          if (!outcome) {
            set({
              terminalHistory: [
                ...state.terminalHistory,
                { input, output: ['Command not recognized in this context.'] },
              ],
            });
            updateAttempt(false);
            return;
          }

          const revealsNewFact = (outcome.revealsFacts ?? []).some(
            (factId) => !state.collectedFacts.includes(factId)
          );
          applyReveal(
            outcome.revealsFacts ?? [],
            { terminalHistory: [...state.terminalHistory, { input, output: outcome.output }] },
            outcome.advances === true,
            outcome.clusterDelta
          );
          if (revealsNewFact) updateAttempt(true);
        },

        pinEvent: (eventId) => {
          const state = get();
          const event = state.campaign?.logCorpus?.find((candidate) => candidate.id === eventId);
          if (!event) return;
          if (state.pendingStageResolution) return;
          if (event.arrivesAtStage > state.stageIndex) return;
          if (!isChoiceVisible(event.visibleWhen, state.decisions)) return;
          if (state.pinnedEvidence.includes(eventId)) return;

          applyReveal(
            event.revealsFact ? [event.revealsFact] : [],
            { pinnedEvidence: [...state.pinnedEvidence, eventId] },
            false,
            undefined
          );
          if (event.revealsFact && !state.collectedFacts.includes(event.revealsFact)) {
            updateAttempt(true);
          }
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

        chooseDecision: (decisionId, optionId) => {
          const state = get();
          if (state.pendingStageResolution) return;
          const decision = state.campaign?.stages[state.stageIndex]?.decision;
          if (decision?.id !== decisionId) return;
          const option = decision?.options.find((candidate) => candidate.id === optionId);
          if (!decision || !option) return;

          applyReveal(
            option.effects?.revealsFacts ?? [],
            { decisions: { ...state.decisions, [decisionId]: optionId } },
            false,
            option.effects?.clusterDelta
          );
        },

        requestGuidance: () => {
          const state = get();
          const stageId = state.campaign?.stages[state.stageIndex]?.id;
          if (!stageId) return;
          set({
            guidanceLevelByStage: {
              ...state.guidanceLevelByStage,
              [stageId]: Math.max(1, state.guidanceLevelByStage[stageId] ?? 0) as GuidanceLevel,
            },
          });
        },

        recordAttempt: updateAttempt,

        markBriefingSeen: (briefingId) => {
          const state = get();
          if (state.seenBriefingIds.includes(briefingId)) return;
          set({ seenBriefingIds: [...state.seenBriefingIds, briefingId] });
        },

        continueFromResolution: () => {
          const state = get();
          if (!state.campaign || !state.pendingStageResolution) return;
          const nextIndex = state.stageIndex + 1;
          const nextStage = state.campaign.stages[nextIndex];
          const required = nextStage?.advanceWhen?.facts ?? [];
          set({
            stageIndex: nextIndex,
            pendingStageResolution:
              required.length > 0 && required.every((factId) => state.collectedFacts.includes(factId))
                ? { stageId: nextStage!.id }
                : null,
            revealedFacts: [],
            activeQuery: '',
            timeRangeId: state.campaign.timeRanges?.[0]?.id ?? 'last-1h',
            clusterStatus: nextStage?.clusterInitial.status ?? state.clusterStatus,
            highlightedNodeIds: nextStage?.clusterInitial.highlightNodeIds ?? state.highlightedNodeIds,
            revealedEdgeIds: nextStage?.clusterInitial.revealEdgeIds ?? state.revealedEdgeIds,
          });
        },

        resetProgress: () => {
          clearRecoverablePersistenceIssue();
          set({ campaign: null, campaignId: null, ...initialTransientState });
        },
      };
    },
    {
      name: 'operation-mango-progress',
      storage: createJSONStorage(() => resilientStorage),
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
        decisions: state.decisions,
        guidanceLevelByStage: state.guidanceLevelByStage,
        failedAttemptsByStage: state.failedAttemptsByStage,
        seenBriefingIds: state.seenBriefingIds,
        pendingStageResolution: state.pendingStageResolution,
      }),
      version: 2,
      merge: (persisted, current) => {
        const normalized = normalizePersistedProgress(persisted);
        reportNormalization(normalized.issue);
        return { ...current, ...normalized.progress, campaign: null };
      },
      migrate: (persisted, version): PersistedProgress => {
        // The Sentinel campaign was rewritten around log-evidence pinning:
        // every stage id and fact id changed, so a v0 save resumes into a
        // stage index that now means something else, carrying dead fact ids.
        // Infiltrator was untouched, so its saves migrate cleanly.
        if (version === 0) {
          const state = persisted as Partial<PersistedProgress> | null;
          if (state?.campaignId === 'sentinel') {
            return { campaignId: null, ...initialTransientState };
          }
        }
        const state = persisted as Partial<PersistedProgress> | null;
        const defaults: Pick<
          PersistedProgress,
          | 'decisions'
          | 'guidanceLevelByStage'
          | 'failedAttemptsByStage'
          | 'seenBriefingIds'
          | 'pendingStageResolution'
        > = {
          decisions: {},
          guidanceLevelByStage: {},
          failedAttemptsByStage: {},
          seenBriefingIds: [],
          pendingStageResolution: null,
        };
        if (version < 2 && state) {
          const decisions = { ...defaults.decisions, ...(state.decisions ?? {}) };
          if (state.stageIndex && state.stageIndex > 3) {
            if (state.campaignId === 'sentinel') decisions['containment-timing'] ??= 'hunt-first';
            if (state.campaignId === 'infiltrator') decisions['operational-order'] ??= 'exfil-first';
          }
          return { ...defaults, ...state, decisions } as PersistedProgress;
        }
        return { ...defaults, ...state } as PersistedProgress;
      },
    }
  )
);

export function useHasHydrated(): boolean {
  // Keep static export safe even if a future storage factory cannot attach
  // the persist API during server rendering. Resilient browser storage keeps
  // this available even when localStorage access itself is denied.
  const [hasHydrated, setHasHydrated] = useState(
    () => useSimStore.persist?.hasHydrated() ?? false
  );

  useEffect(() => {
    // Match the initializer fallback and subscribe when hydration is active.
    setHasHydrated(useSimStore.persist?.hasHydrated() ?? false);
    const unsubscribe = useSimStore.persist?.onFinishHydration(() => setHasHydrated(true));
    return unsubscribe;
  }, []);

  return hasHydrated;
}
