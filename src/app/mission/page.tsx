'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSimStore, useHasHydrated } from '@/engine/store';
import { chapter1Campaigns } from '@/content/chapter1';
import { Terminal } from '@/components/Terminal/Terminal';
import { ClusterDiagram } from '@/components/ClusterDiagram/ClusterDiagram';
import { BriefingOverlay } from '@/components/BriefingOverlay/BriefingOverlay';
import { LogExplorer } from '@/components/LogExplorer/LogExplorer';
import { AttackMap } from '@/components/AttackMap/AttackMap';
import { CaseFile } from '@/components/CaseFile/CaseFile';

export default function MissionPage() {
  const router = useRouter();
  const campaignId = useSimStore((state) => state.campaignId);
  const campaign = useSimStore((state) => state.campaign);
  const hydrateCampaign = useSimStore((state) => state.hydrateCampaign);
  const stageIndex = useSimStore((state) => state.stageIndex);
  const revealedFacts = useSimStore((state) => state.revealedFacts);
  const collectedFacts = useSimStore((state) => state.collectedFacts);
  const terminalHistory = useSimStore((state) => state.terminalHistory);
  const clusterStatus = useSimStore((state) => state.clusterStatus);
  const highlightedNodeIds = useSimStore((state) => state.highlightedNodeIds);
  const revealedEdgeIds = useSimStore((state) => state.revealedEdgeIds);
  const pinnedEvidence = useSimStore((state) => state.pinnedEvidence);
  const activeQuery = useSimStore((state) => state.activeQuery);
  const timeRangeId = useSimStore((state) => state.timeRangeId);
  const runCommand = useSimStore((state) => state.runCommand);
  const pinEvent = useSimStore((state) => state.pinEvent);
  const unpinEvent = useSimStore((state) => state.unpinEvent);
  const setQuery = useSimStore((state) => state.setQuery);
  const setTimeRange = useSimStore((state) => state.setTimeRange);

  const [showBriefing, setShowBriefing] = useState(true);
  const hasHydrated = useHasHydrated();

  useEffect(() => {
    // Read campaignId fresh from the store here rather than trusting the
    // `campaignId` selector value captured at render time: `hasHydrated`
    // flips via a separate manually-polled effect (see useHasHydrated),
    // not through the same zustand subscription tick as `campaignId`, so a
    // render can transiently see `hasHydrated: true` paired with a
    // not-yet-updated `campaignId` selector snapshot even though the
    // store's real, current state already has the correct value.
    if (hasHydrated && !useSimStore.getState().campaignId) {
      router.replace('/campaign-select');
    }
  }, [hasHydrated, campaignId, router]);

  useEffect(() => {
    if (hasHydrated && campaignId && !campaign) {
      hydrateCampaign(chapter1Campaigns[campaignId]);
    }
  }, [hasHydrated, campaignId, campaign, hydrateCampaign]);

  useEffect(() => {
    setShowBriefing(true);
  }, [stageIndex]);

  useEffect(() => {
    if (campaign && stageIndex >= campaign.stages.length) {
      router.push('/debrief');
    }
  }, [campaign, stageIndex, router]);

  const stage = campaign?.stages[stageIndex];

  /** Only what the index has received by this stage is searchable. */
  const arrivedEvents = useMemo(
    () => (campaign?.logCorpus ?? []).filter((event) => event.arrivesAtStage <= stageIndex),
    [campaign, stageIndex]
  );

  const pinnedEvents = useMemo(
    () => (campaign?.logCorpus ?? []).filter((event) => pinnedEvidence.includes(event.id)),
    [campaign, pinnedEvidence]
  );

  const establishedFacts = useMemo(
    () =>
      collectedFacts
        .map((factId) => campaign?.factLibrary[factId])
        .filter((fact): fact is NonNullable<typeof fact> => fact !== undefined),
    [collectedFacts, campaign]
  );

  if (!hasHydrated || !campaignId || !campaign || !stage) return null;

  const revealedSet = new Set(revealedFacts);
  const availableCommands = stage.commands.filter((command) =>
    (command.requiresFacts ?? []).every((factId) => revealedSet.has(factId))
  );

  const hasLogExplorer = (campaign.logCorpus?.length ?? 0) > 0;
  const hasAttackMap = (campaign.attackMap?.length ?? 0) > 0;
  const showTerminal = stage.commands.length > 0;

  return (
    <main className="flex min-h-screen flex-col gap-4 p-4 lg:p-6">
      {showBriefing && (
        <BriefingOverlay
          title={stage.title}
          objective={stage.objective}
          lines={stage.briefing}
          onDismiss={() => setShowBriefing(false)}
        />
      )}

      <header className="flex items-baseline justify-between border-b border-mango-500/20 pb-3">
        <h1 className="heading-stencil text-sm">
          {campaign.title} — {stage.title}
        </h1>
        <p className="font-mono text-xs text-mango-300/50">
          Stage {stageIndex + 1} of {campaign.stages.length}
        </p>
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 xl:grid-cols-[3fr_1.4fr]">
        <div className="flex min-h-0 flex-col gap-4">
          {hasLogExplorer && (
            <div className="min-h-[28rem] flex-1">
              <LogExplorer
                key={stage.id}
                events={arrivedEvents}
                ranges={campaign.timeRanges ?? []}
                timeRangeId={timeRangeId}
                query={activeQuery}
                suggestions={stage.suggestedQueries ?? []}
                hint={stage.hint}
                pinnedIds={pinnedEvidence}
                onQueryChange={setQuery}
                onTimeRangeChange={setTimeRange}
                onPin={pinEvent}
                onUnpin={unpinEvent}
              />
            </div>
          )}

          {showTerminal && (
            <Terminal
              history={terminalHistory}
              availableCommands={availableCommands}
              onSubmit={runCommand}
            />
          )}
        </div>

        <aside className="flex min-h-0 flex-col gap-4">
          <div className="rounded border border-mango-500/20 bg-orchard-900/40 p-3">
            {hasAttackMap ? (
              <AttackMap nodes={campaign.attackMap ?? []} facts={collectedFacts} />
            ) : (
              <ClusterDiagram
                highlightedNodeIds={highlightedNodeIds}
                revealedEdgeIds={revealedEdgeIds}
                status={clusterStatus}
              />
            )}
          </div>

          <div className="min-h-0 flex-1 rounded border border-mango-500/20 bg-orchard-900/40 p-3">
            <CaseFile
              objective={stage.objective}
              pinnedEvents={pinnedEvents}
              facts={establishedFacts}
              onUnpin={unpinEvent}
            />
          </div>
        </aside>
      </div>
    </main>
  );
}
