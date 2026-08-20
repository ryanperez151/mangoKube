import { useState, useEffect } from 'react';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { parseCommand } from './terminalParser';
import { canChooseDecision, isChoiceVisible } from './conditions';
import { chapter1Campaigns } from '@/content/chapter1';
import { DEFAULT_COLUMN_FIELDS, DEFAULT_COLUMN_SORT } from './logFields';
import {
  clearRecoverablePersistenceIssue,
  initialPersistedProgress,
  normalizePersistedProgress,
  reportNormalization,
  resilientStorage,
  safeDecisionDefault,
} from './persistence';
import type {
  Campaign,
  CampaignId,
  ClusterDelta,
  ColumnSort,
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
  columnFields: string[];
  columnSort: ColumnSort;
  fieldPanelPinned: boolean;
  decisions: Record<string, string>;
  guidanceLevelByStage: Record<string, GuidanceLevel>;
  failedAttemptsByStage: Record<string, number>;
  seenBriefingIds: string[];
  seenPrimerIds: string[];
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
  columnFields: string[];
  columnSort: ColumnSort;
  fieldPanelPinned: boolean;
  decisions: Record<string, string>;
  guidanceLevelByStage: Record<string, GuidanceLevel>;
  failedAttemptsByStage: Record<string, number>;
  seenBriefingIds: string[];
  seenPrimerIds: string[];
  pendingStageResolution: PendingStageResolution | null;
  startCampaign: (campaign: Campaign) => void;
  hydrateCampaign: (campaign: Campaign) => void;
  runCommand: (input: string) => void;
  pinEvent: (eventId: string) => void;
  unpinEvent: (eventId: string) => void;
  setQuery: (query: string) => void;
  setTimeRange: (rangeId: string) => void;
  setColumnFields: (fields: string[]) => void;
  setColumnSort: (sort: ColumnSort) => void;
  setFieldPanelPinned: (pinned: boolean) => void;
  chooseDecision: (decisionId: string, optionId: string) => void;
  requestGuidance: () => void;
  recordAttempt: (successful: boolean) => void;
  markBriefingSeen: (briefingId: string) => void;
  markPrimerSeen: (campaignId: CampaignId) => void;
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
        // Auto-escalation walks the same ladder as the Reveal button, so a
        // struggling player and a curious one see the tiers in the same
        // order: orient, then narrow, then the exact query or command.
        const unlocked = failedAttempts >= 6 ? 3 : failedAttempts >= 4 ? 2 : failedAttempts >= 2 ? 1 : 0;
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
          // Reading the primer is knowledge about the console, not progress
          // through a mission, so replaying a role does not re-gate it.
          // Only an explicit reset clears it.
          const { seenPrimerIds } = get();
          set({
            campaign,
            campaignId: campaign.id,
            ...initialTransientState,
            seenPrimerIds,
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
          const outcome = parseCommand(
            input,
            stage,
            new Set(state.revealedFacts),
            state.decisions,
            state.campaign.terminalProfile?.ambientCommands
          );

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

          const terminalHistory = [
            ...state.terminalHistory,
            { input, output: outcome.output },
          ];
          const hasProgressEffect =
            outcome.advances === true ||
            (outcome.revealsFacts?.length ?? 0) > 0 ||
            outcome.clusterDelta !== undefined;
          if (!hasProgressEffect) {
            set({ terminalHistory });
            return;
          }

          const revealsNewFact = (outcome.revealsFacts ?? []).some(
            (factId) => !state.collectedFacts.includes(factId)
          );
          applyReveal(
            outcome.revealsFacts ?? [],
            { terminalHistory },
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

        setColumnFields: (fields) => set({ columnFields: fields }),

        setColumnSort: (sort) => set({ columnSort: sort }),

        setFieldPanelPinned: (pinned) => set({ fieldPanelPinned: pinned }),

        chooseDecision: (decisionId, optionId) => {
          const state = get();
          const stage = state.campaign?.stages[state.stageIndex];
          const decision = stage?.decision;
          if (decision?.id !== decisionId) return;
          if (!canChooseDecision(decision, stage?.id, state.pendingStageResolution, state.decisions)) return;
          const option = decision?.options.find((candidate) => candidate.id === optionId);
          if (!decision || !option) return;

          applyReveal(
            option.effects?.revealsFacts ?? [],
            { decisions: { ...state.decisions, [decisionId]: optionId } },
            false,
            option.effects?.clusterDelta
          );
        },

        /** Reveal the next tier for this stage, stopping at the exact answer. */
        requestGuidance: () => {
          const state = get();
          const stageId = state.campaign?.stages[state.stageIndex]?.id;
          if (!stageId) return;
          const current = state.guidanceLevelByStage[stageId] ?? 0;
          if (current >= 3) return;
          set({
            guidanceLevelByStage: {
              ...state.guidanceLevelByStage,
              [stageId]: (current + 1) as GuidanceLevel,
            },
          });
        },

        recordAttempt: updateAttempt,

        markBriefingSeen: (briefingId) => {
          const state = get();
          if (state.seenBriefingIds.includes(briefingId)) return;
          set({ seenBriefingIds: [...state.seenBriefingIds, briefingId] });
        },

        markPrimerSeen: (campaignId) => {
          const state = get();
          if (state.seenPrimerIds.includes(campaignId)) return;
          set({ seenPrimerIds: [...state.seenPrimerIds, campaignId] });
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
        columnFields: state.columnFields,
        columnSort: state.columnSort,
        fieldPanelPinned: state.fieldPanelPinned,
        decisions: state.decisions,
        guidanceLevelByStage: state.guidanceLevelByStage,
        failedAttemptsByStage: state.failedAttemptsByStage,
        seenBriefingIds: state.seenBriefingIds,
        seenPrimerIds: state.seenPrimerIds,
        pendingStageResolution: state.pendingStageResolution,
      }),
      version: 3,
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
          | 'seenPrimerIds'
          | 'pendingStageResolution'
          | 'columnFields'
          | 'columnSort'
          | 'fieldPanelPinned'
        > = {
          decisions: {},
          guidanceLevelByStage: {},
          failedAttemptsByStage: {},
          seenBriefingIds: [],
          seenPrimerIds: [],
          pendingStageResolution: null,
          columnFields: [...DEFAULT_COLUMN_FIELDS],
          columnSort: { ...DEFAULT_COLUMN_SORT },
          fieldPanelPinned: false,
        };
        if (version < 2 && state) {
          const decisions = { ...defaults.decisions, ...(state.decisions ?? {}) };
          if (
            (state.campaignId === 'sentinel' || state.campaignId === 'infiltrator') &&
            typeof state.stageIndex === 'number'
          ) {
            chapter1Campaigns[state.campaignId].stages.forEach((stage, decisionStageIndex) => {
              if (!stage.decision || state.stageIndex! <= decisionStageIndex) return;
              const defaultOptionId = safeDecisionDefault(state.campaignId!, stage.decision.id);
              if (defaultOptionId) decisions[stage.decision.id] ??= defaultOptionId;
            });
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
