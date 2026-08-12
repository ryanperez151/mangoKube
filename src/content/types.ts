export type CampaignId = 'infiltrator' | 'sentinel';

export interface Fact {
  id: string;
  label: string;
  detail: string;
}

export interface ClusterDelta {
  highlightNodeIds?: string[];
  revealEdgeIds?: string[];
  status?: 'nominal' | 'suspicious' | 'compromised' | 'contained';
}

export interface CommandOutcome {
  output: string[];
  revealsFacts?: string[];
  advances?: boolean;
  clusterDelta?: ClusterDelta;
}

export interface CommandDefinition {
  match: RegExp;
  description: string;
  requiresFacts?: string[];
  outcome: CommandOutcome;
}

export interface Stage {
  id: string;
  title: string;
  briefing: string[];
  objective: string;
  commands: CommandDefinition[];
  clusterInitial: ClusterDelta;
  /** Stage completes once every listed fact is collected. */
  advanceWhen?: { facts: string[] };
  /** Clickable chips that insert real query syntax into the search bar. */
  suggestedQueries?: QuerySuggestion[];
  /** Offered after repeated empty result sets. */
  hint?: string;
}

export interface QuerySuggestion {
  label: string;
  query: string;
}

export interface CampaignDebrief {
  narrative: string[];
  lesson: string;
  nextChapterTeaser: string;
}

export interface Campaign {
  id: CampaignId;
  title: string;
  tagline: string;
  stages: Stage[];
  factLibrary: Record<string, Fact>;
  debrief: CampaignDebrief;
  /** Present only on campaigns that use the log explorer. */
  logCorpus?: LogEvent[];
  attackMap?: AttackMapNode[];
  timeRanges?: TimeRange[];
}

export interface TerminalEntry {
  input: string;
  output: string[];
}

export type LogSource = 'k8s-audit' | 'edr' | 'apiserver' | 'ci-cd';

export interface LogEvent {
  id: string;
  /** ISO 8601, e.g. '2026-08-12T02:14:03Z' */
  timestamp: string;
  source: LogSource;
  message: string;
  fields: Record<string, string>;
  /** Index of the earliest stage at which this event is in the searchable index. */
  arrivesAtStage: number;
  /** Pinning this event reveals this fact. Absent on benign events. */
  revealsFact?: string;
  /** Shown when the event is pinned: why it matters, or why it is routine. */
  analystNote?: string;
}

export interface TimeRange {
  id: string;
  label: string;
  /** ISO 8601, inclusive. */
  startIso: string;
  /** ISO 8601, exclusive. */
  endIso: string;
}

export interface QueryPredicate {
  field: string;
  value: string;
  negated: boolean;
}

export interface QueryAst {
  predicates: QueryPredicate[];
  /** Unqualified tokens, matched as substrings against every field value. */
  terms: string[];
}

export type QueryParseResult =
  | { ok: true; ast: QueryAst }
  | { ok: false; error: string };

export interface QueryResult {
  events: LogEvent[];
  /** Predicate fields no visible event carries — surfaced as a UI warning. */
  unknownFields: string[];
}

export type AttackMapNodeState = 'undiscovered' | 'suspected' | 'confirmed' | 'contained';

export interface AttackMapNode {
  id: string;
  label: string;
  /** Plain-language tactic name, e.g. 'Privilege Escalation'. */
  tactic: string;
  summary: string;
  lesson: string;
  prevention: string;
  /** Every listed fact must be collected for the state to apply. Empty = never. */
  suspectedByFacts: string[];
  confirmedByFacts: string[];
  containedByFacts: string[];
  /** Layout position along the branch, in the map's 0-100 coordinate space. */
  x: number;
  y: number;
  /** Branch parent; absent on the trunk node. */
  parentId?: string;
}
