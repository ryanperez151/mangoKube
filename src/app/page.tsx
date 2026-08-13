'use client';

import { useRouter } from 'next/navigation';
import { chapter1Campaigns } from '@/content/chapter1';
import { useHasHydrated, useSimStore } from '@/engine/store';
import {
  ActionButton,
  AppFrame,
  BrandMark,
  DesktopGate,
  Panel,
  StatusBadge,
} from '@/components/Cinematic/Cinematic';

function LandingExperience() {
  const router = useRouter();
  const hasHydrated = useHasHydrated();
  const campaignId = useSimStore((state) => state.campaignId);
  const stageIndex = useSimStore((state) => state.stageIndex);
  const resetProgress = useSimStore((state) => state.resetProgress);

  if (!hasHydrated) return <AppFrame message="Recovering operation state" />;

  const persistedCampaign = campaignId ? chapter1Campaigns[campaignId] : null;
  const completed = Boolean(
    persistedCampaign && stageIndex >= persistedCampaign.stages.length
  );

  function startNewOperation() {
    if (
      campaignId &&
      !window.confirm('Replace the current operation? Existing campaign progress will be cleared.')
    ) {
      return;
    }
    resetProgress();
    router.push('/campaign-select');
  }

  return (
    <main className="app-shell scene-atmosphere overflow-y-auto px-10 py-8">
      <div className="relative z-10 mx-auto flex min-h-full max-w-7xl flex-col">
        <header className="flex items-center justify-between border-b border-white/10 pb-5">
          <BrandMark />
          <StatusBadge tone="action">Chapter 01 / Active</StatusBadge>
        </header>

        <div className="grid flex-1 items-center gap-12 py-12 lg:grid-cols-[1.2fr_0.8fr]">
          <section>
            <p className="font-mono text-xs uppercase tracking-[0.28em] text-mango-300">
              Kubernetes incident simulation
            </p>
            <h1 className="mt-5 max-w-4xl font-display text-7xl font-bold uppercase leading-[0.88] tracking-[0.035em] text-slate-50 xl:text-8xl">
              One cluster.
              <span className="block text-mango-500">Two truths.</span>
            </h1>
            <p className="mt-8 max-w-2xl text-lg leading-8 text-slate-300">
              MangoCorp&apos;s global logistics run on Kubernetes. A supply-chain compromise planted
              an implant inside the cluster. Enter the same incident as the operator exploiting it
              or the responder racing to contain it.
            </p>
          </section>

          <Panel className="p-7">
            <div className="border-b border-white/10 pb-5">
              <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-slate-500">
                Operation state
              </p>
              <h2 className="mt-2 font-display text-3xl font-bold uppercase tracking-[0.08em] text-slate-100">
                {completed ? 'Case resolved' : campaignId ? 'Session recovered' : 'Awaiting assignment'}
              </h2>
              {persistedCampaign && (
                <p className="mt-2 text-sm text-slate-400">
                  {persistedCampaign.title} · Stage {Math.min(stageIndex + 1, persistedCampaign.stages.length)} of{' '}
                  {persistedCampaign.stages.length}
                </p>
              )}
            </div>

            <div className="mt-6 grid gap-3">
              {completed ? (
                <ActionButton onClick={() => router.push('/debrief')}>View debrief</ActionButton>
              ) : campaignId ? (
                <ActionButton onClick={() => router.push('/mission')}>Continue operation</ActionButton>
              ) : null}
              <ActionButton variant={campaignId ? 'secondary' : 'primary'} onClick={startNewOperation}>
                New operation
              </ActionButton>
            </div>
          </Panel>
        </div>

        <footer className="flex items-center justify-between border-t border-white/10 py-4 font-mono text-[10px] uppercase tracking-[0.16em] text-slate-600">
          <span>Focused Scene A1</span>
          <span>Keyboard operational</span>
        </footer>
      </div>
    </main>
  );
}

export default function LandingPage() {
  return (
    <DesktopGate>
      <LandingExperience />
    </DesktopGate>
  );
}
