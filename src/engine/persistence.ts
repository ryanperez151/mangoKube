import { useSyncExternalStore } from 'react';
import type { StateStorage } from 'zustand/middleware';
import { chapter1Campaigns } from '@/content/chapter1';
import type {
  CampaignId,
  GuidanceLevel,
  PendingStageResolution,
  TerminalEntry,
} from '@/content/types';

export type ClusterStatus = 'nominal' | 'suspicious' | 'compromised' | 'contained';

export interface PersistedProgress {
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

export const initialPersistedProgress: PersistedProgress = {
  campaignId: null,
  stageIndex: 0,
  revealedFacts: [],
  collectedFacts: [],
  terminalHistory: [],
  clusterStatus: 'nominal',
  highlightedNodeIds: [],
  revealedEdgeIds: [],
  pinnedEvidence: [],
  activeQuery: '',
  timeRangeId: 'last-1h',
  decisions: {},
  guidanceLevelByStage: {},
  failedAttemptsByStage: {},
  seenBriefingIds: [],
  pendingStageResolution: null,
};

export type PersistenceStatus =
  | { kind: 'ready'; message: null }
  | { kind: 'memory'; message: string }
  | { kind: 'recovered'; message: string }
  | { kind: 'corrupt'; message: string };

const READY: PersistenceStatus = { kind: 'ready', message: null };
const CLUSTER_NODE_IDS = new Set([
  'ci-deploy-bot',
  'inventory-sync',
  'pricing-api',
  'cluster-admin-binding',
  'log-rotator',
]);
const CLUSTER_EDGE_IDS = new Set([
  'ci-deploy-bot-to-clusteradmin',
  'log-rotator-to-clusteradmin',
]);
let status: PersistenceStatus = READY;
const listeners = new Set<() => void>();

function publish(next: PersistenceStatus): void {
  if (status.kind === 'memory' && next.kind !== 'memory') return;
  if (status.kind === next.kind && status.message === next.message) return;
  status = next;
  listeners.forEach((listener) => listener());
}

export function getPersistenceStatus(): PersistenceStatus {
  return status;
}

export function usePersistenceStatus(): PersistenceStatus {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    getPersistenceStatus,
    () => READY
  );
}

export function clearRecoverablePersistenceIssue(): void {
  if (status.kind !== 'memory') publish(READY);
}

function asRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

const PERSISTED_PROGRESS_KEYS = new Set(Object.keys(initialPersistedProgress));

function isCanonicalEmptyProgress(source: Record<string, unknown>): boolean {
  const keys = Object.keys(source);
  if (
    keys.length !== PERSISTED_PROGRESS_KEYS.size ||
    keys.some((key) => !PERSISTED_PROGRESS_KEYS.has(key)) ||
    [...PERSISTED_PROGRESS_KEYS].some((key) => !Object.prototype.hasOwnProperty.call(source, key))
  ) return false;

  const emptyArrays = [
    source.revealedFacts,
    source.collectedFacts,
    source.terminalHistory,
    source.highlightedNodeIds,
    source.revealedEdgeIds,
    source.pinnedEvidence,
    source.seenBriefingIds,
  ];
  const emptyRecords = [
    source.decisions,
    source.guidanceLevelByStage,
    source.failedAttemptsByStage,
  ];

  return (
    source.campaignId === null &&
    source.stageIndex === 0 &&
    source.clusterStatus === 'nominal' &&
    source.activeQuery === '' &&
    source.timeRangeId === 'last-1h' &&
    source.pendingStageResolution === null &&
    emptyArrays.every((value) => Array.isArray(value) && value.length === 0) &&
    emptyRecords.every((value) => {
      const record = asRecord(value);
      return record === value && Object.keys(record).length === 0;
    })
  );
}

function uniqueKnownStrings(value: unknown, valid: ReadonlySet<string>): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((item): item is string => typeof item === 'string' && valid.has(item)))];
}

function normalizeTerminalHistory(value: unknown): TerminalEntry[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    const candidate = asRecord(entry);
    if (typeof candidate.input !== 'string' || !Array.isArray(candidate.output)) return [];
    const output = candidate.output.filter((line): line is string => typeof line === 'string');
    return output.length === candidate.output.length ? [{ input: candidate.input, output }] : [];
  });
}

export function normalizePersistedProgress(value: unknown): {
  progress: PersistedProgress;
  issue: 'none' | 'recovered' | 'corrupt';
} {
  // Zustand passes `undefined` to `merge` when the storage key is absent.
  // This is the only non-envelope value that represents a genuine fresh browser.
  if (value === undefined) {
    return { progress: { ...initialPersistedProgress }, issue: 'none' };
  }

  const source = asRecord(value);
  if (source.campaignId == null) {
    return {
      progress: { ...initialPersistedProgress },
      issue: isCanonicalEmptyProgress(source) ? 'none' : 'corrupt',
    };
  }
  if (source.campaignId !== 'sentinel' && source.campaignId !== 'infiltrator') {
    return { progress: { ...initialPersistedProgress }, issue: 'corrupt' };
  }

  const campaignId = source.campaignId;
  const campaign = chapter1Campaigns[campaignId];
  let recovered = false;
  const rawStageIndex = source.stageIndex;
  const stageIndex =
    typeof rawStageIndex === 'number' && Number.isFinite(rawStageIndex)
      ? Math.min(campaign.stages.length, Math.max(0, Math.trunc(rawStageIndex)))
      : 0;
  if (stageIndex !== rawStageIndex) recovered = true;

  const factIds = new Set(Object.keys(campaign.factLibrary));
  const eventIds = new Set((campaign.logCorpus ?? []).map((event) => event.id));
  const stageIds = new Set(campaign.stages.map((stage) => stage.id));
  const revealedFacts = uniqueKnownStrings(source.revealedFacts, factIds);
  const collectedFacts = uniqueKnownStrings(source.collectedFacts, factIds);
  const pinnedEvidence = uniqueKnownStrings(source.pinnedEvidence, eventIds);
  const highlightedNodeIds = uniqueKnownStrings(source.highlightedNodeIds, CLUSTER_NODE_IDS);
  const revealedEdgeIds = uniqueKnownStrings(source.revealedEdgeIds, CLUSTER_EDGE_IDS);
  const terminalHistory = normalizeTerminalHistory(source.terminalHistory);
  if (!Array.isArray(source.revealedFacts) || revealedFacts.length !== source.revealedFacts.length) recovered = true;
  if (!Array.isArray(source.collectedFacts) || collectedFacts.length !== source.collectedFacts.length) recovered = true;
  if (!Array.isArray(source.pinnedEvidence) || pinnedEvidence.length !== source.pinnedEvidence.length) recovered = true;
  if (!Array.isArray(source.highlightedNodeIds) || highlightedNodeIds.length !== source.highlightedNodeIds.length) recovered = true;
  if (!Array.isArray(source.revealedEdgeIds) || revealedEdgeIds.length !== source.revealedEdgeIds.length) recovered = true;
  if (!Array.isArray(source.terminalHistory) || terminalHistory.length !== source.terminalHistory.length) recovered = true;

  const rawDecisions = asRecord(source.decisions);
  const decisions: Record<string, string> = {};
  campaign.stages.forEach((stage, decisionStageIndex) => {
    if (!stage.decision) return;
    const selected = rawDecisions[stage.decision.id];
    const option = stage.decision.options.find((candidate) => candidate.id === selected);
    if (option) decisions[stage.decision.id] = option.id;
    else if (stageIndex > decisionStageIndex) {
      decisions[stage.decision.id] = stage.decision.options[0].id;
      recovered = true;
    } else if (selected !== undefined) recovered = true;
  });
  if (Object.keys(rawDecisions).some((id) => !campaign.stages.some((stage) => stage.decision?.id === id))) recovered = true;

  const rawGuidance = asRecord(source.guidanceLevelByStage);
  const guidanceLevelByStage: Record<string, GuidanceLevel> = {};
  Object.entries(rawGuidance).forEach(([stageId, level]) => {
    if (stageIds.has(stageId) && (level === 1 || level === 2 || level === 3)) guidanceLevelByStage[stageId] = level;
    else recovered = true;
  });

  const rawAttempts = asRecord(source.failedAttemptsByStage);
  const failedAttemptsByStage: Record<string, number> = {};
  Object.entries(rawAttempts).forEach(([stageId, attempts]) => {
    if (stageIds.has(stageId) && typeof attempts === 'number' && Number.isFinite(attempts) && attempts >= 0) {
      failedAttemptsByStage[stageId] = Math.trunc(attempts);
    } else recovered = true;
  });

  const pending = asRecord(source.pendingStageResolution);
  const activeStageId = campaign.stages[stageIndex]?.id;
  const pendingStageResolution =
    typeof pending.stageId === 'string' && pending.stageId === activeStageId
      ? { stageId: pending.stageId }
      : null;
  if (source.pendingStageResolution != null && pendingStageResolution === null) recovered = true;

  const clusterStatuses: ClusterStatus[] = ['nominal', 'suspicious', 'compromised', 'contained'];
  const clusterStatus = clusterStatuses.includes(source.clusterStatus as ClusterStatus)
    ? (source.clusterStatus as ClusterStatus)
    : campaign.stages[Math.min(stageIndex, campaign.stages.length - 1)]?.clusterInitial.status ?? 'nominal';
  if (clusterStatus !== source.clusterStatus) recovered = true;

  const timeRanges = campaign.timeRanges ?? [];
  const timeRangeId =
    typeof source.timeRangeId === 'string' &&
    (timeRanges.length === 0 || timeRanges.some((range) => range.id === source.timeRangeId))
      ? source.timeRangeId
      : timeRanges[0]?.id ?? 'last-1h';
  if (timeRangeId !== source.timeRangeId) recovered = true;

  return {
    progress: {
      campaignId,
      stageIndex,
      revealedFacts,
      collectedFacts,
      terminalHistory,
      clusterStatus,
      highlightedNodeIds,
      revealedEdgeIds,
      pinnedEvidence,
      activeQuery: typeof source.activeQuery === 'string' ? source.activeQuery : '',
      timeRangeId,
      decisions,
      guidanceLevelByStage,
      failedAttemptsByStage,
      seenBriefingIds: uniqueKnownStrings(source.seenBriefingIds, stageIds),
      pendingStageResolution,
    },
    issue: recovered ? 'recovered' : 'none',
  };
}

export function reportNormalization(issue: 'none' | 'recovered' | 'corrupt'): void {
  if (issue === 'recovered') publish({ kind: 'recovered', message: 'Saved progress was repaired. Review the recovered operation or reset it safely.' });
  if (issue === 'corrupt') publish({ kind: 'corrupt', message: 'Saved progress could not be read. Reset progress to choose a playable campaign.' });
}

const memory = new Map<string, string>();

function unavailable(): void {
  publish({ kind: 'memory', message: 'Progress cannot be saved in this browser. This operation will continue in this tab.' });
}

export const resilientStorage: StateStorage = {
  getItem(name) {
    if (typeof window === 'undefined') return memory.get(name) ?? null;
    try {
      const raw = window.localStorage.getItem(name);
      if (raw !== null) {
        try {
          JSON.parse(raw);
        } catch {
          publish({ kind: 'corrupt', message: 'Saved progress could not be read. Reset progress to choose a playable campaign.' });
          return null;
        }
      }
      return raw;
    } catch {
      unavailable();
      return memory.get(name) ?? null;
    }
  },
  setItem(name, value) {
    memory.set(name, value);
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(name, value);
    } catch {
      unavailable();
    }
  },
  removeItem(name) {
    memory.delete(name);
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.removeItem(name);
    } catch {
      unavailable();
    }
  },
};
