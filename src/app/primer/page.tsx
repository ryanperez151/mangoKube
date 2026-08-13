'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSimStore, useHasHydrated } from '@/engine/store';
import { chapter1Campaigns } from '@/content/chapter1';
import { Primer } from '@/components/Primer/Primer';
import { AppFrame, DesktopGate } from '@/components/Cinematic/Cinematic';
import { PersistenceStatusNotice } from '@/components/PersistenceStatus/PersistenceStatus';

function PrimerExperience() {
  const router = useRouter();
  const campaignId = useSimStore((state) => state.campaignId);
  const campaign = useSimStore((state) => state.campaign);
  const hydrateCampaign = useSimStore((state) => state.hydrateCampaign);
  const markPrimerSeen = useSimStore((state) => state.markPrimerSeen);
  const hasHydrated = useHasHydrated();

  useEffect(() => {
    // See the equivalent comment in src/app/mission/page.tsx: read campaignId
    // fresh from the store rather than the selector snapshot, since
    // hasHydrated and campaignId can transiently desync across a render.
    if (hasHydrated && !useSimStore.getState().campaignId) {
      router.replace('/campaign-select');
    }
  }, [hasHydrated, campaignId, router]);

  useEffect(() => {
    if (hasHydrated && campaignId && !campaign) {
      hydrateCampaign(chapter1Campaigns[campaignId]);
    }
  }, [hasHydrated, campaignId, campaign, hydrateCampaign]);

  if (!hasHydrated || !campaignId || !campaign || !campaign.primer) {
    return <AppFrame message="Preparing familiarization material" />;
  }

  function begin() {
    if (!campaignId) return;
    markPrimerSeen(campaignId);
    router.push('/mission');
  }

  return (
    <Primer
      primer={campaign.primer}
      roleLabel={campaign.title}
      onBegin={begin}
      onBack={() => router.push('/campaign-select')}
    />
  );
}

export default function PrimerPage() {
  return (
    <DesktopGate>
      <div className="app-shell flex min-h-0 flex-col bg-scene-ink">
        <PersistenceStatusNotice placement="inline" className="mx-4 mt-2" />
        <div className="status-page-content h-0 min-h-0 flex-1 overflow-hidden">
          <PrimerExperience />
        </div>
      </div>
    </DesktopGate>
  );
}
