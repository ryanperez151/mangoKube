import { useSyncExternalStore } from 'react';
import type { StateStorage } from 'zustand/middleware';
import { chapter1Campaigns } from '@/content/chapter1';
import { DEFAULT_COLUMN_FIELDS, DEFAULT_COLUMN_SORT, TIME_FIELD } from './logFields';
import type {
  CampaignId,
  ColumnSort,
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
  /** Selectable result columns in table order. Never contains `time`. */
  columnFields: string[];
  columnSort: ColumnSort;
  /** Whether the field browser stays open as a split rather than an overlay. */
  fieldPanelPinned: boolean;
  decisions: Record<string, string>;
  guidanceLevelByStage: Record<string, GuidanceLevel>;
  failedAttemptsByStage: Record<string, number>;
  seenBriefingIds: string[];
  /** Campaign ids whose familiarization primer has been read. */
  seenPrimerIds: string[];
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
  columnFields: [...DEFAULT_COLUMN_FIELDS],
  columnSort: { ...DEFAULT_COLUMN_SORT },
  fieldPanelPinned: false,
  decisions: {},
  guidanceLevelByStage: {},
  failedAttemptsByStage: {},
  seenBriefingIds: [],
  seenPrimerIds: [],
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
const CAMPAIGN_IDS: ReadonlySet<string> = new Set<CampaignId>(['sentinel', 'infiltrator']);
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
/**
 * Keys added after v2 shipped. A save written before they existed is still a
 * genuine, readable save — treating its absence as corruption would discard
 * real progress and show the player a recovery warning for nothing.
 */
const OPTIONAL_PROGRESS_KEYS = new Set([
  'seenPrimerIds',
  'columnFields',
  'columnSort',
  'fieldPanelPinned',
]);
const SAFE_DECISION_DEFAULTS: Record<CampaignId, Readonly<Record<string, string>>> = {
  sentinel: { 'containment-timing': 'hunt-first' },
  infiltrator: { 'operational-order': 'exfil-first' },
};

export function safeDecisionDefault(campaignId: CampaignId, decisionId: string): string | undefined {
  return SAFE_DECISION_DEFAULTS[campaignId][decisionId];
}

function isCanonicalEmptyProgress(source: Record<string, unknown>): boolean {
  const keys = Object.keys(source);
  if (
    keys.some((key) => !PERSISTED_PROGRESS_KEYS.has(key)) ||
    [...PERSISTED_PROGRESS_KEYS].some(
      (key) =>
        !OPTIONAL_PROGRESS_KEYS.has(key) && !Object.prototype.hasOwnProperty.call(source, key)
    )
  ) return false;

  const emptyArrays = [
    source.revealedFacts,
    source.collectedFacts,
    source.terminalHistory,
    source.highlightedNodeIds,
    source.revealedEdgeIds,
    source.pinnedEvidence,
    source.seenBriefingIds,
    source.seenPrimerIds ?? [],
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
    (source.columnFields === undefined ||
      (Array.isArray(source.columnFields) &&
        source.columnFields.join(',') === DEFAULT_COLUMN_FIELDS.join(','))) &&
    (source.columnSort === undefined ||
      (asRecord(source.columnSort).field === DEFAULT_COLUMN_SORT.field &&
        asRecord(source.columnSort).direction === DEFAULT_COLUMN_SORT.direction)) &&
    (source.fieldPanelPinned === undefined || source.fieldPanelPinned === false) &&
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

  const pending = asRecord(source.pendingStageResolution);
  const activeStageId = campaign.stages[stageIndex]?.id;
  const pendingStageResolution =
    typeof pending.stageId === 'string' && pending.stageId === activeStageId
      ? { stageId: pending.stageId }
      : null;
  if (source.pendingStageResolution != null && pendingStageResolution === null) recovered = true;

  const rawDecisions = asRecord(source.decisions);
  const decisions: Record<string, string> = {};
  campaign.stages.forEach((stage, decisionStageIndex) => {
    if (!stage.decision) return;
    const selected = rawDecisions[stage.decision.id];
    const option = stage.decision.options.find((candidate) => candidate.id === selected);
    if (option) decisions[stage.decision.id] = option.id;
    const pendingCrossedBeforeStageDecision =
      stageIndex === decisionStageIndex &&
      stage.decision.timing === 'before-stage' &&
      pendingStageResolution?.stageId === stage.id;
    if (!option && (stageIndex > decisionStageIndex || pendingCrossedBeforeStageDecision)) {
      const defaultOptionId = safeDecisionDefault(campaignId, stage.decision.id);
      if (defaultOptionId) decisions[stage.decision.id] = defaultOptionId;
      recovered = true;
    } else if (!option && selected !== undefined) recovered = true;
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

  // Column layout. `source` and `message` are promoted fields every event
  // carries, so they belong in the valid set alongside the corpus's own keys.
  // `TIME_FIELD` is excluded on principle, not because it's needed today: no
  // corpus event happens to use that key, so nothing currently forces this
  // exclusion to matter. But `columnFields` and the pinned time column are
  // rendered by two different code paths in `ResultsTable`, so if a future
  // event ever did carry a `time` field, an unfiltered set would let a saved
  // `columnFields: ['time', ...]` re-render it as a second, redundant `time`
  // column sitting right next to the real one.
  const corpusFields = new Set<string>(
    [
      'source',
      'message',
      ...(campaign.logCorpus ?? []).flatMap((event) => Object.keys(event.fields)),
    ].filter((field) => field !== TIME_FIELD)
  );

  const rawColumnFields = source.columnFields;
  const columnFields = Array.isArray(rawColumnFields)
    ? [
        ...new Set(
          rawColumnFields.filter(
            (field): field is string => typeof field === 'string' && corpusFields.has(field)
          )
        ),
      ].slice(0, 12)
    : [...DEFAULT_COLUMN_FIELDS];
  if (
    rawColumnFields !== undefined &&
    (!Array.isArray(rawColumnFields) || columnFields.length !== rawColumnFields.length)
  ) {
    recovered = true;
  }

  const rawSort = asRecord(source.columnSort);
  const sortField =
    typeof rawSort.field === 'string' &&
    (rawSort.field === TIME_FIELD || corpusFields.has(rawSort.field))
      ? rawSort.field
      : DEFAULT_COLUMN_SORT.field;
  const sortDirection = rawSort.direction === 'asc' || rawSort.direction === 'desc'
    ? rawSort.direction
    : DEFAULT_COLUMN_SORT.direction;
  const columnSort: ColumnSort = { field: sortField, direction: sortDirection };
  if (
    source.columnSort !== undefined &&
    (sortField !== rawSort.field || sortDirection !== rawSort.direction)
  ) {
    recovered = true;
  }

  const fieldPanelPinned = source.fieldPanelPinned === true;
  if (
    source.fieldPanelPinned !== undefined &&
    typeof source.fieldPanelPinned !== 'boolean'
  ) {
    recovered = true;
  }

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
      columnFields,
      columnSort,
      fieldPanelPinned,
      decisions,
      guidanceLevelByStage,
      failedAttemptsByStage,
      seenBriefingIds: uniqueKnownStrings(source.seenBriefingIds, stageIds),
      seenPrimerIds: uniqueKnownStrings(source.seenPrimerIds, CAMPAIGN_IDS),
      pendingStageResolution,
    },
    issue: recovered ? 'recovered' : 'none',
  };
}

export function reportNormalization(issue: 'none' | 'recovered' | 'corrupt'): void {
  if (issue === 'recovered') publish({ kind: 'recovered', message: 'Saved progress was repaired. Review the recovered operation or reset it safely.' });
  if (issue === 'corrupt') reportCorruptStorage();
}

const memory = new Map<string, string>();

function reportCorruptStorage(): void {
  publish({ kind: 'corrupt', message: 'Saved progress could not be read. Reset progress to choose a playable campaign.' });
}

function isReadablePersistedEnvelope(value: unknown): boolean {
  const envelope = asRecord(value);
  if (envelope !== value || !Object.prototype.hasOwnProperty.call(envelope, 'state')) return false;
  return normalizePersistedProgress(envelope.state).issue !== 'corrupt';
}

function unavailable(): void {
  publish({ kind: 'memory', message: 'Progress cannot be saved in this browser. This operation will continue in this tab.' });
}

export const resilientStorage: StateStorage = {
  getItem(name) {
    if (typeof window === 'undefined') return memory.get(name) ?? null;
    try {
      const raw = window.localStorage.getItem(name);
      if (raw === null) return null;
      try {
        const envelope: unknown = JSON.parse(raw);
        if (!isReadablePersistedEnvelope(envelope)) {
          reportCorruptStorage();
          return null;
        }
        return raw;
      } catch {
        reportCorruptStorage();
        return null;
      }
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
