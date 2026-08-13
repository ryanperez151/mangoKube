'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSimStore, useHasHydrated } from '@/engine/store';
import { chapter1Campaigns } from '@/content/chapter1';
import { DebriefPanel } from '@/components/DebriefPanel/DebriefPanel';
import { AppFrame, DesktopGate } from '@/components/Cinematic/Cinematic';
import { PersistenceStatusNotice } from '@/components/PersistenceStatus/PersistenceStatus';

function DebriefExperience() {
  const router = useRouter();
  const campaignId = useSimStore((state) => state.campaignId);
  const campaign = useSimStore((state) => state.campaign);
  const stageIndex = useSimStore((state) => state.stageIndex);
  const decisions = useSimStore((state) => state.decisions);
  const collectedFacts = useSimStore((state) => state.collectedFacts);
  const clusterStatus = useSimStore((state) => state.clusterStatus);
  const hydrateCampaign = useSimStore((state) => state.hydrateCampaign);
  const startCampaign = useSimStore((state) => state.startCampaign);
  const hasHydrated = useHasHydrated();

  useEffect(() => {
    // See the equivalent comment in src/app/mission/page.tsx: read
    // campaignId fresh from the store rather than the selector snapshot,
    // since hasHydrated and campaignId can transiently desync across a
    // single render.
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
    const state = useSimStore.getState();
    const persistedCampaign = state.campaignId ? chapter1Campaigns[state.campaignId] : null;
    if (hasHydrated && persistedCampaign && state.stageIndex < persistedCampaign.stages.length) {
      router.replace('/mission');
    }
  }, [hasHydrated, campaignId, stageIndex, router]);

  if (!hasHydrated || !campaignId || !campaign || stageIndex < campaign.stages.length) {
    return <AppFrame message="Reconstructing operation debrief" />;
  }

  function begin(role: 'sentinel' | 'infiltrator') {
    if (!window.confirm('Replace completed progress and begin this role at stage 1?')) return;
    startCampaign(chapter1Campaigns[role]);
    router.push('/mission');
  }

  return (
    <DebriefPanel
      campaign={campaign}
      decisions={decisions}
      collectedFacts={collectedFacts}
      clusterStatus={clusterStatus}
      onReplay={() => begin(campaignId)}
      onOtherRole={() => begin(campaignId === 'sentinel' ? 'infiltrator' : 'sentinel')}
    />
  );
}

export default function DebriefPage() {
  return (
    <DesktopGate>
      <div className="app-shell flex min-h-0 flex-col bg-scene-ink">
        <PersistenceStatusNotice placement="inline" className="mx-4 mt-2" />
        <div className="status-page-content min-h-0 flex-1">
          <DebriefExperience />
        </div>
      </div>
    </DesktopGate>
  );
}
