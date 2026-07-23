'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSimStore } from '@/engine/store';
import { DebriefPanel } from '@/components/DebriefPanel/DebriefPanel';

export default function DebriefPage() {
  const router = useRouter();
  const campaign = useSimStore((state) => state.campaign);
  const resetProgress = useSimStore((state) => state.resetProgress);

  useEffect(() => {
    if (!campaign) {
      router.replace('/campaign-select');
    }
  }, [campaign, router]);

  if (!campaign) {
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
