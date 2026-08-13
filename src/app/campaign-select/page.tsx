'use client';

import { useRouter } from 'next/navigation';
import { useSimStore } from '@/engine/store';
import { chapter1Campaigns } from '@/content/chapter1';
import type { CampaignId } from '@/content/types';
import {
  ActionButton,
  BrandMark,
  DesktopGate,
  Panel,
  StatusBadge,
} from '@/components/Cinematic/Cinematic';

function CampaignSelectExperience() {
  const router = useRouter();
  const startCampaign = useSimStore((state) => state.startCampaign);

  function choose(id: CampaignId) {
    startCampaign(chapter1Campaigns[id]);
    router.push('/mission');
  }

  return (
    <main className="app-shell scene-atmosphere overflow-y-auto px-10 py-8">
      <div className="relative z-10 mx-auto max-w-7xl">
        <header className="flex items-center justify-between border-b border-white/10 pb-5">
          <BrandMark compact />
          <StatusBadge>Role assignment</StatusBadge>
        </header>

        <section className="py-9">
          <p className="font-mono text-xs uppercase tracking-[0.24em] text-slate-400">Select perspective</p>
          <h1 className="mt-3 font-display text-5xl font-bold uppercase tracking-[0.06em] text-slate-50">
            Choose your side
          </h1>
          <p className="mt-3 max-w-2xl text-base leading-7 text-slate-400">
            Both dossiers follow the same breach. Your role changes the evidence, tools, and operational decisions.
          </p>
        </section>

        <div className="grid gap-6 lg:grid-cols-2">
          {(Object.keys(chapter1Campaigns) as CampaignId[]).map((id, index) => {
            const campaign = chapter1Campaigns[id];
            const role = campaign.role;
            return (
              <article key={id} aria-labelledby={`${id}-title`}>
                <Panel className="flex h-full flex-col p-7">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-slate-500">
                        Dossier 0{index + 1}
                      </p>
                      <h2
                        id={`${id}-title`}
                        className="mt-2 font-display text-4xl font-bold uppercase tracking-[0.06em] text-slate-50"
                      >
                        {campaign.title}
                      </h2>
                    </div>
                    <StatusBadge>{id}</StatusBadge>
                  </div>
                  <p className="mt-4 text-base leading-7 text-slate-300">{campaign.tagline}</p>

                  <dl className="mt-6 grid gap-4 border-y border-white/10 py-5">
                    <div>
                      <dt className="font-mono text-[10px] uppercase tracking-[0.17em] text-slate-500">Role fantasy</dt>
                      <dd className="mt-1 text-sm leading-6 text-slate-200">{role?.fantasy}</dd>
                    </div>
                    <div>
                      <dt className="font-mono text-[10px] uppercase tracking-[0.17em] text-slate-500">Primary mechanic</dt>
                      <dd className="mt-1 text-sm leading-6 text-slate-200">{role?.primaryMechanic}</dd>
                    </div>
                    <div>
                      <dt className="font-mono text-[10px] uppercase tracking-[0.17em] text-slate-500">Learning focus</dt>
                      <dd className="mt-1 text-sm leading-6 text-slate-200">{role?.learningFocus}</dd>
                    </div>
                  </dl>

                  <div className="mt-5 flex-1">
                    <h3 className="font-mono text-[10px] uppercase tracking-[0.17em] text-slate-500">Five-stage operation</h3>
                    <ol className="mt-3 grid gap-2">
                      {campaign.stages.map((stage, stageIndex) => (
                        <li key={stage.id} className="flex items-center gap-3 text-sm text-slate-300">
                          <span className="flex h-6 w-6 items-center justify-center border border-white/10 font-mono text-[10px] text-slate-500">
                            {stageIndex + 1}
                          </span>
                          {stage.title}
                        </li>
                      ))}
                    </ol>
                  </div>

                  <ActionButton className="mt-7 w-full" onClick={() => choose(id)}>
                    Deploy as {campaign.title}
                  </ActionButton>
                </Panel>
              </article>
            );
          })}
        </div>
      </div>
    </main>
  );
}

export default function CampaignSelectPage() {
  return (
    <DesktopGate>
      <CampaignSelectExperience />
    </DesktopGate>
  );
}
