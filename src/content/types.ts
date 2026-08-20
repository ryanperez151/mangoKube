export type CampaignId = 'infiltrator' | 'sentinel';

export type GuidanceLevel = 1 | 2 | 3;

/** Every listed decision must have the specified option selected. */
export type ChoiceCondition = Record<string, string>;

export interface ConditionalCopy {
  when?: ChoiceCondition;
  lines: string[];
}

export interface ObjectiveStep {
  id: string;
  label: string;
  detail?: string;
  requiresFacts: string[];
  visibleWhen?: ChoiceCondition;
}

export interface GuidanceStep {
  level: GuidanceLevel;
  lines: string[];
  insertText?: string;
  visibleWhen?: ChoiceCondition;
}

export interface Fact {
  id: string;
  label: string;
  detail: string;
}

/** One row of a primer reference table: a command, field, or log source. */
export interface PrimerEntry {
  /** Rendered in mono — a command, a field name, or a log source id. */
  term: string;
  meaning: string;
  /** Why it matters to this role. */
  note?: string;
}

export interface PrimerSection {
  id: string;
  title: string;
  body: string[];
  entries?: PrimerEntry[];
}

/**
 * Role-specific familiarization material. Gated once before stage 1, then
 * kept reachable from the mission guidance tab as a reference.
 */
export interface CampaignPrimer {
  title: string;
  /** One-line framing shown under the title. */
  tagline: string;
  intro: string[];
  sections: PrimerSection[];
}

/** How much of a trace an attacker action leaves in this chapter's sources. */
export type Observability =
  /** An artifact exists and is distinctive enough to alert on. */
  | 'alerting'
  /** The control plane records it, but it is lost in routine volume. */
  | 'buried'
  /** Nothing in this chapter's sources records it at all. */
  | 'invisible';

/**
 * One step of the shared attack, joining what the Infiltrator did to what
 * the Sentinel could see. Rendered from both sides in the debrief.
 */
export interface AttackTimelineEntry {
  id: string;
  timestamp: string;
  /** Attack map node this step belongs to. */
  nodeId: string;
  action: string;
  /** The literal command, when the Infiltrator runs one. */
  command?: string;
  infiltratorFacts?: string[];
  /**
   * Corpus event ids this action generated. Empty unless 'alerting'.
   * A step whose artifact differs by decision route lists every variant,
   * most canonical first; `resolveArtifacts` picks the one in play.
   */
  artifactEventIds: string[];
  /**
   * Why no corpus artifact exists. Required whenever `artifactEventIds` is
   * empty — including 'alerting' steps that fall outside the window the
   * Sentinel's index captured.
   */
  artifactNote?: string;
  sentinelFacts: string[];
  observability: Observability;
  /** Why this step decided the incident. Present on highlighted entries. */
  critical?: string;
  detection: { query?: string; rule: string };
}

export interface ClusterDelta {
  highlightNodeIds?: string[];
  revealEdgeIds?: string[];
  status?: 'nominal' | 'suspicious' | 'compromised' | 'contained';
}

export interface DecisionEffects {
  revealsFacts?: string[];
  clusterDelta?: ClusterDelta;
}

export interface MissionDecisionOption {
  id: string;
  label: string;
  description: string;
  effects?: DecisionEffects;
}

export interface MissionDecision {
  id: string;
  timing: 'before-stage' | 'after-stage';
  prompt: string;
  options: MissionDecisionOption[];
}

export interface StageResolution {
  title: string;
  summary: string[];
  conditionalSummary?: ConditionalCopy[];
}

export interface PendingStageResolution {
  stageId: string;
}

export interface CampaignRole {
  fantasy: string;
  primaryMechanic: string;
  learningFocus: string;
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
  visibleWhen?: ChoiceCondition;
  outcome: CommandOutcome;
}

export interface Stage {
  id: string;
  title: string;
  briefing: string[];
  conditionalBriefing?: ConditionalCopy[];
  objective: string;
  objectiveSteps?: ObjectiveStep[];
  guidance?: GuidanceStep[];
  decision?: MissionDecision;
  resolution?: StageResolution;
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
  /** Plain-language detection guidance, shown only when present. */
  detection?: string[];
  nextChapterTeaser: string;
}

export interface Campaign {
  id: CampaignId;
  title: string;
  tagline: string;
  role?: CampaignRole;
  /** Role-specific shell framing and harmless commands available in every stage. */
  terminalProfile?: CampaignTerminalProfile;
  /** Familiarization material shown before stage 1. */
  primer?: CampaignPrimer;
  stages: Stage[];
  factLibrary: Record<string, Fact>;
  debrief: CampaignDebrief;
  conditionalDebrief?: ConditionalCopy[];
  /** Present only on campaigns that use the log explorer. */
  logCorpus?: LogEvent[];
  attackMap?: AttackMapNode[];
  timeRanges?: TimeRange[];
}

export interface TerminalEntry {
  input: string;
  output: string[];
}

export interface CampaignTerminalProfile {
  prompt: string;
  banner: string[];
  ambientCommands: CommandDefinition[];
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
  visibleWhen?: ChoiceCondition;
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
