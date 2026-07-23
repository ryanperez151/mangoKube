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
}

export interface TerminalEntry {
  input: string;
  output: string[];
}
