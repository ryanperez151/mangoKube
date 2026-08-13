'use client';

import type { AttackMapNode, AttackTimelineEntry, CampaignId, LogEvent, Observability } from '@/content/types';
import { cn } from '@/lib/cn';
import { isStepEstablished, resolveArtifacts } from '@/engine/attackTimeline';
import { StatusBadge } from '@/components/Cinematic/Cinematic';

const OBSERVABILITY_LABEL: Record<Observability, string> = {
  alerting: 'Left an artifact',
  buried: 'Logged, but buried',
  invisible: 'No trace',
};

function formatClock(timestamp: string): string {
  const date = new Date(timestamp);
  const time = date.toISOString().slice(11, 16);
  const day = date.toISOString().slice(0, 10);
  return `${day} ${time}Z`;
}

function ArtifactLine({ event }: { event: LogEvent }) {
  return (
    <p className="break-words font-mono text-[11px] leading-5 text-slate-300">
      <span className="text-slate-500">{formatClock(event.timestamp)}</span>{' '}
      <span className="text-mango-300">{event.source}</span>{' '}
      <span>{event.message}</span>
    </p>
  );
}

interface AttackTimelineProps {
  campaignId: CampaignId;
  timeline: readonly AttackTimelineEntry[];
  corpus: readonly LogEvent[];
  nodes: readonly AttackMapNode[];
  decisions: Readonly<Record<string, string>>;
  collectedFacts: readonly string[];
}

/**
 * One authored attack, rendered from whichever side the player just finished.
 * The attacker sees the trail each action left; the analyst sees which of
 * those artifacts they actually turned into evidence, and which steps were
 * never going to appear in any search.
 */
export function AttackTimeline({
  campaignId,
  timeline,
  corpus,
  nodes,
  decisions,
  collectedFacts,
}: AttackTimelineProps) {
  const isSentinel = campaignId === 'sentinel';
  const nodeLabel = (nodeId: string) => nodes.find((node) => node.id === nodeId)?.tactic ?? nodeId;
  const unseen = timeline.filter((entry) => entry.observability === 'invisible');

  return (
    <>
      <section aria-labelledby="timeline-heading" data-testid="debrief-timeline">
        <h2
          id="timeline-heading"
          className="font-display text-2xl font-bold uppercase tracking-[0.07em] text-slate-100"
        >
          {isSentinel ? 'The attack, reconstructed' : 'The trail you left'}
        </h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
          {isSentinel
            ? 'Every step of the intrusion, against the artifact it produced and whether you established it as evidence. The steps you could not prove are as instructive as the ones you could.'
            : 'Every action you took, against what a defender watching this cluster would have seen. Reads disappear into routine volume; writes do not.'}
        </p>

        <ol className="mt-5 space-y-3">
          {timeline.map((entry, index) => {
            const artifacts = resolveArtifacts(entry, corpus, decisions);
            const established = isStepEstablished(entry, collectedFacts);
            const provable = entry.sentinelFacts.length > 0;

            return (
              <li
                key={entry.id}
                data-testid={`timeline-entry-${entry.id}`}
                className={cn(
                  'border-l-2 bg-white/[0.02] p-4',
                  entry.critical ? 'border-mango-500 bg-mango-500/[0.06]' : 'border-white/15'
                )}
              >
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[10px] uppercase tracking-[0.14em] text-slate-400">
                  <span>{String(index + 1).padStart(2, '0')}</span>
                  <span>{formatClock(entry.timestamp)}</span>
                  <span className="text-slate-500">{nodeLabel(entry.nodeId)}</span>
                  <StatusBadge tone={entry.observability === 'alerting' ? 'action' : 'neutral'}>
                    {OBSERVABILITY_LABEL[entry.observability]}
                  </StatusBadge>
                  {isSentinel && provable && (
                    <span className={established ? 'text-leaf-300' : 'text-slate-400'}>
                      {established ? '✓ Found' : '○ Missed'}
                    </span>
                  )}
                </div>

                <p className="mt-2 text-sm leading-6 text-slate-100">{entry.action}</p>

                {entry.command && (
                  <p className="mt-2 break-words bg-black/40 p-2 font-mono text-[11px] leading-5 text-mango-300">
                    {entry.command}
                  </p>
                )}

                {entry.critical && (
                  <p className="mt-2 text-sm leading-6 text-mango-300">{entry.critical}</p>
                )}

                <div className="mt-3 border-t border-white/10 pt-3">
                  <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-slate-500">
                    {artifacts.length > 0 ? 'Artifact' : 'Why there is nothing to find'}
                  </p>
                  <div className="mt-1">
                    {artifacts.length > 0 ? (
                      artifacts.map((event) => <ArtifactLine key={event.id} event={event} />)
                    ) : (
                      <p className="text-xs leading-5 text-slate-400">{entry.artifactNote}</p>
                    )}
                  </div>

                  {isSentinel && provable && !established && artifacts[0]?.analystNote && (
                    <p className="mt-2 border-l-2 border-white/20 pl-3 text-xs leading-5 text-slate-400">
                      {artifacts[0].analystNote}
                    </p>
                  )}

                  <p className="mt-2 text-xs leading-5 text-slate-400">
                    {entry.detection.query && (
                      <span className="mr-2 bg-black/40 px-1 font-mono text-[11px] text-slate-300">
                        {entry.detection.query}
                      </span>
                    )}
                    {entry.detection.rule}
                  </p>
                </div>
              </li>
            );
          })}
        </ol>
      </section>

      {isSentinel && unseen.length > 0 && (
        <section aria-labelledby="unseen-heading" data-testid="debrief-unseen">
          <h2
            id="unseen-heading"
            className="font-display text-2xl font-bold uppercase tracking-[0.07em] text-slate-100"
          >
            What you could not have seen
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
            These steps happened. Nothing in the sources available to you recorded them, so no query
            would have surfaced them and no amount of diligence would have found them. Knowing where
            your visibility ends is part of the finding.
          </p>
          <ul className="mt-4 grid gap-2">
            {unseen.map((entry) => (
              <li key={entry.id} className="border border-white/10 bg-white/[0.02] p-4">
                <p className="text-sm font-semibold text-slate-100">{entry.action}</p>
                <p className="mt-1 text-xs leading-5 text-slate-400">{entry.artifactNote}</p>
                <p className="mt-2 border-l-2 border-leaf-500/50 pl-3 text-xs leading-5 text-leaf-300">
                  {entry.detection.rule}
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
