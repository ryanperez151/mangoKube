'use client';

import { useRouter } from 'next/navigation';
import { useSimStore } from '@/engine/store';
import { chapter1Campaigns } from '@/content/chapter1';
import type { CampaignId } from '@/content/types';

export default function CampaignSelectPage() {
  const router = useRouter();
  const startCampaign = useSimStore((state) => state.startCampaign);

  function choose(id: CampaignId) {
    startCampaign(chapter1Campaigns[id]);
    router.push('/mission');
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 p-8">
      <h1 className="text-2xl font-bold text-mango-500">Choose Your Side</h1>
      <div className="flex flex-col gap-6 md:flex-row">
        {(Object.keys(chapter1Campaigns) as CampaignId[]).map((id) => {
          const campaign = chapter1Campaigns[id];
          return (
            <button
              key={id}
              onClick={() => choose(id)}
              className="max-w-sm rounded-lg border border-mango-500/40 p-6 text-left hover:bg-mango-900"
            >
              <h2 className="text-xl font-bold text-mango-500">{campaign.title}</h2>
              <p className="mt-2 text-mango-300">{campaign.tagline}</p>
            </button>
          );
        })}
      </div>
    </main>
  );
}
