'use client';

import { useRouter } from 'next/navigation';
import { useSimStore } from '@/engine/store';
import { DebriefPanel } from '@/components/DebriefPanel/DebriefPanel';

export default function DebriefPage() {
  const router = useRouter();
  const campaign = useSimStore((state) => state.campaign);
  const resetProgress = useSimStore((state) => state.resetProgress);

  if (!campaign) {
    if (typeof window !== 'undefined') {
      router.replace('/campaign-select');
    }
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
