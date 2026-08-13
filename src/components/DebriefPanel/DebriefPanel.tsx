'use client';

import type { Campaign } from '@/content/types';
import { resolveConditionalCopy } from '@/engine/conditions';
import { chapter1AttackTimeline } from '@/content/chapter1/attackTimeline';
import { sentinelAttackMap } from '@/content/chapter1/attackMap';
import { sentinelLogCorpus } from '@/content/chapter1/logs';
import { ActionButton, Panel, SceneShell, StatusBadge } from '@/components/Cinematic/Cinematic';
import { AttackTimeline } from '@/components/DebriefPanel/AttackTimeline';

type ClusterStatus = 'nominal' | 'suspicious' | 'compromised' | 'contained';

interface DebriefPanelProps {
  campaign: Campaign;
  decisions: Readonly<Record<string, string>>;
  collectedFacts: readonly string[];
  clusterStatus: ClusterStatus;
  onReplay: () => void;
  onOtherRole: () => void;
}

export function DebriefPanel({
  campaign,
  decisions,
  collectedFacts,
  clusterStatus,
  onReplay,
  onOtherRole,
}: DebriefPanelProps) {
  const narrative = [
    ...campaign.debrief.narrative,
    ...resolveConditionalCopy(campaign.conditionalDebrief, decisions),
  ];
  const selectedDecisions = campaign.stages.flatMap((stage) => {
    if (!stage.decision) return [];
    const option = stage.decision.options.find((candidate) => decisions[stage.decision!.id] === candidate.id);
    return option ? [{ decision: stage.decision, option }] : [];
  });
  const establishedFacts = collectedFacts.flatMap((factId) => {
    const fact = campaign.factLibrary[factId];
    return fact ? [fact] : [];
  });
  return (
    <SceneShell
      label="Operation outcome debrief"
      eyebrow={`${campaign.id} / Chapter 01 complete`}
      title={campaign.id === 'sentinel' ? 'Incident contained' : 'Mission accomplished'}
      footer={
        <div className="flex flex-wrap gap-3">
          <ActionButton onClick={onReplay}>Replay This Role</ActionButton>
          <ActionButton variant="secondary" onClick={onOtherRole}>Play the Other Role</ActionButton>
        </div>
      }
    >
      <div className="space-y-8">
        <section data-testid="debrief-narrative" aria-labelledby="outcome-heading">
          <StatusBadge tone={campaign.id === 'sentinel' ? 'established' : 'compromised'}>Outcome established</StatusBadge>
          <h2 id="outcome-heading" className="mt-4 font-display text-2xl font-bold uppercase tracking-[0.07em] text-slate-100">
            Narrative outcome
          </h2>
          <div className="mt-3 space-y-3 text-base leading-7 text-slate-300">
            {narrative.map((line, index) => <p key={index}>{line}</p>)}
          </div>
        </section>

        <section aria-labelledby="decision-heading">
          <h2 id="decision-heading" className="font-display text-2xl font-bold uppercase tracking-[0.07em] text-slate-100">
            Decision and consequence
          </h2>
          <div className="mt-3 grid gap-3">
            {selectedDecisions.map(({ decision, option }) => (
              <Panel key={decision.id} className="p-4">
                <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-slate-400">{decision.prompt}</p>
                <h3 className="mt-2 font-display text-xl font-bold uppercase tracking-[0.05em] text-mango-300">{option.label}</h3>
                <p className="mt-1 text-sm leading-6 text-slate-300">{option.description}</p>
              </Panel>
            ))}
          </div>
        </section>

        <AttackTimeline
          campaignId={campaign.id}
          timeline={chapter1AttackTimeline}
          corpus={sentinelLogCorpus}
          nodes={sentinelAttackMap}
          decisions={decisions}
          collectedFacts={collectedFacts}
        />

        <section aria-labelledby="findings-heading">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 id="findings-heading" className="font-display text-2xl font-bold uppercase tracking-[0.07em] text-slate-100">Established findings</h2>
            {campaign.id === 'infiltrator' && <StatusBadge tone="compromised">Cluster outcome: {clusterStatus}</StatusBadge>}
          </div>
          <ul className="mt-3 grid gap-2 lg:grid-cols-2">
            {establishedFacts.map((fact) => (
              <li key={fact.id} className="border border-white/10 bg-white/[0.02] p-3">
                <p className="text-sm font-semibold text-slate-100">{fact.label}</p>
                <p className="mt-1 text-xs leading-5 text-slate-400">{fact.detail}</p>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="lesson-heading" className="border border-mango-500/35 bg-mango-500/[0.05] p-5">
          <h2 id="lesson-heading" className="font-display text-2xl font-bold uppercase tracking-[0.07em] text-mango-300">Transferable Kubernetes lesson</h2>
          <p className="mt-3 text-base leading-7 text-slate-200">{campaign.debrief.lesson}</p>
        </section>

        {campaign.debrief.detection && campaign.debrief.detection.length > 0 && (
          <section data-testid="debrief-detection" aria-labelledby="detection-heading">
            <h2 id="detection-heading" className="font-display text-2xl font-bold uppercase tracking-[0.07em] text-leaf-300">Sentinel detection guidance</h2>
            <ul className="mt-3 grid gap-2">
              {campaign.debrief.detection.map((rule, index) => (
                <li key={index} className="border-l-2 border-leaf-500/50 pl-4 text-sm leading-6 text-slate-300">{rule}</li>
              ))}
            </ul>
          </section>
        )}

        <section aria-labelledby="next-heading" className="border-t border-white/10 pt-6">
          <h2 id="next-heading" className="font-mono text-xs uppercase tracking-[0.2em] text-mango-300">Next chapter</h2>
          <p className="mt-2 text-lg italic leading-7 text-slate-300">{campaign.debrief.nextChapterTeaser}</p>
        </section>
      </div>
    </SceneShell>
  );
}
