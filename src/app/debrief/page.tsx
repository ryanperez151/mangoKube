'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSimStore, useHasHydrated } from '@/engine/store';
import { chapter1Campaigns } from '@/content/chapter1';
import { DebriefPanel } from '@/components/DebriefPanel/DebriefPanel';
import { AppFrame, DesktopGate } from '@/components/Cinematic/Cinematic';

function DebriefExperience() {
  const router = useRouter();
  const campaignId = useSimStore((state) => state.campaignId);
  const campaign = useSimStore((state) => state.campaign);
  const hydrateCampaign = useSimStore((state) => state.hydrateCampaign);
  const resetProgress = useSimStore((state) => state.resetProgress);
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

  if (!hasHydrated || !campaignId || !campaign) {
    return <AppFrame message="Reconstructing operation debrief" />;
  }

  function handleRestart() {
    resetProgress();
    router.push('/campaign-select');
  }

  return (
    <main className="app-shell overflow-y-auto py-8">
      <DebriefPanel
        narrative={campaign.debrief.narrative}
        lesson={campaign.debrief.lesson}
        detection={campaign.debrief.detection}
        nextChapterTeaser={campaign.debrief.nextChapterTeaser}
        onRestart={handleRestart}
      />
    </main>
  );
}

export default function DebriefPage() {
  return (
    <DesktopGate>
      <DebriefExperience />
    </DesktopGate>
  );
}
