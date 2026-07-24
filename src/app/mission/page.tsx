'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSimStore, useHasHydrated } from '@/engine/store';
import { chapter1Campaigns } from '@/content/chapter1';
import { Terminal } from '@/components/Terminal/Terminal';
import { ClusterDiagram } from '@/components/ClusterDiagram/ClusterDiagram';
import { BriefingOverlay } from '@/components/BriefingOverlay/BriefingOverlay';

export default function MissionPage() {
  const router = useRouter();
  const campaignId = useSimStore((state) => state.campaignId);
  const campaign = useSimStore((state) => state.campaign);
  const hydrateCampaign = useSimStore((state) => state.hydrateCampaign);
  const stageIndex = useSimStore((state) => state.stageIndex);
  const revealedFacts = useSimStore((state) => state.revealedFacts);
  const terminalHistory = useSimStore((state) => state.terminalHistory);
  const clusterStatus = useSimStore((state) => state.clusterStatus);
  const highlightedNodeIds = useSimStore((state) => state.highlightedNodeIds);
  const revealedEdgeIds = useSimStore((state) => state.revealedEdgeIds);
  const runCommand = useSimStore((state) => state.runCommand);

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

  if (!hasHydrated || !campaignId || !campaign || stageIndex >= campaign.stages.length) {
    return null;
  }

  const stage = campaign.stages[stageIndex];
  const revealedSet = new Set(revealedFacts);
  const availableCommands = stage.commands.filter((command) =>
    (command.requiresFacts ?? []).every((factId) => revealedSet.has(factId))
  );

  return (
    <main className="grid min-h-screen grid-cols-1 gap-6 p-6 md:grid-cols-2">
      {showBriefing && (
        <BriefingOverlay
          title={stage.title}
          objective={stage.objective}
          lines={stage.briefing}
          onDismiss={() => setShowBriefing(false)}
        />
      )}

      <section>
        <p className="mb-4 text-sm text-mango-300">{stage.objective}</p>
        <Terminal history={terminalHistory} availableCommands={availableCommands} onSubmit={runCommand} />
      </section>

      <section>
        <ClusterDiagram
          highlightedNodeIds={highlightedNodeIds}
          revealedEdgeIds={revealedEdgeIds}
          status={clusterStatus}
        />
      </section>
    </main>
  );
}
