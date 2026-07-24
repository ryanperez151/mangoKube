'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSimStore, useHasHydrated } from '@/engine/store';
import { chapter1Campaigns } from '@/content/chapter1';
import { DebriefPanel } from '@/components/DebriefPanel/DebriefPanel';

export default function DebriefPage() {
  const router = useRouter();
  const campaignId = useSimStore((state) => state.campaignId);
  const campaign = useSimStore((state) => state.campaign);
  const hydrateCampaign = useSimStore((state) => state.hydrateCampaign);
  const resetProgress = useSimStore((state) => state.resetProgress);
  const hasHydrated = useHasHydrated();

  useEffect(() => {
    if (hasHydrated && !campaignId) {
      router.replace('/campaign-select');
    }
  }, [hasHydrated, campaignId, router]);

  useEffect(() => {
    if (hasHydrated && campaignId && !campaign) {
      hydrateCampaign(chapter1Campaigns[campaignId]);
    }
  }, [hasHydrated, campaignId, campaign, hydrateCampaign]);

  if (!hasHydrated || !campaignId || !campaign) {
    return null;
  }

  function handleRestart() {
    resetProgress();
    router.push('/campaign-select');
  }

  return (
    <DebriefPanel
      narrative={campaign.debrief.narrative}
      lesson={campaign.debrief.lesson}
      nextChapterTeaser={campaign.debrief.nextChapterTeaser}
      onRestart={handleRestart}
    />
  );
}
