'use client';

import type { CampaignPrimer, PrimerSection } from '@/content/types';
import { cn } from '@/lib/cn';
import { ActionButton, Panel, SceneShell, StatusBadge } from '@/components/Cinematic/Cinematic';

/**
 * The reference tables are the part players come back to, so they render the
 * same whether the primer is the full-screen gate or embedded in the mission
 * guidance tab. Only the chrome around them differs.
 */
export function PrimerSectionBody({ section, compact = false }: { section: PrimerSection; compact?: boolean }) {
  return (
    <div className={compact ? 'space-y-2' : 'space-y-3'}>
      {section.body.map((line, index) => (
        <p
          key={index}
          className={cn('leading-7 text-slate-300', compact ? 'text-xs leading-6' : 'text-base')}
        >
          {line}
        </p>
      ))}

      {section.entries && section.entries.length > 0 && (
        <dl className={cn('grid gap-px border border-white/10 bg-white/10', compact ? 'mt-3' : 'mt-5')}>
          {section.entries.map((entry) => (
            <div
              key={entry.term}
              className={cn('bg-scene-raised', compact ? 'p-2.5' : 'p-4 lg:grid lg:grid-cols-[15rem_minmax(0,1fr)] lg:gap-5')}
            >
              <dt
                className={cn(
                  'break-words font-mono text-mango-300',
                  compact ? 'text-[11px]' : 'text-xs'
                )}
              >
                {entry.term}
              </dt>
              <dd className={compact ? 'mt-1' : 'mt-1 lg:mt-0'}>
                <p className={cn('leading-6 text-slate-200', compact ? 'text-xs' : 'text-sm')}>
                  {entry.meaning}
                </p>
                {entry.note && (
                  <p
                    className={cn(
                      'mt-1 border-l-2 border-mango-500/40 pl-3 leading-6 text-slate-400',
                      compact ? 'text-[11px]' : 'text-xs'
                    )}
                  >
                    {entry.note}
                  </p>
                )}
              </dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}

interface PrimerProps {
  primer: CampaignPrimer;
  roleLabel: string;
  onBegin: () => void;
  onBack: () => void;
}

export function Primer({ primer, roleLabel, onBegin, onBack }: PrimerProps) {
  return (
    <SceneShell
      label="Familiarization primer"
      eyebrow={`${roleLabel} / Familiarization`}
      title={primer.title}
      footer={
        <div className="flex flex-wrap items-center gap-3">
          <ActionButton onClick={onBegin}>Begin the operation</ActionButton>
          <ActionButton variant="quiet" onClick={onBack}>
            Change role
          </ActionButton>
          <p className="text-xs text-slate-400">
            This stays available from the Guidance tab during the mission.
          </p>
        </div>
      }
    >
      <div className="space-y-10">
        <div>
          <StatusBadge tone="action">{primer.tagline}</StatusBadge>
          <div className="mt-4 space-y-3">
            {primer.intro.map((line, index) => (
              <p key={index} className="text-lg leading-8 text-slate-200">
                {line}
              </p>
            ))}
          </div>
        </div>

        {primer.sections.map((section, index) => (
          <section key={section.id} aria-labelledby={`primer-${section.id}`}>
            <div className="flex items-baseline gap-3 border-b border-white/10 pb-3">
              <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-slate-500">
                {String(index + 1).padStart(2, '0')}
              </span>
              <h2
                id={`primer-${section.id}`}
                className="font-display text-2xl font-bold uppercase tracking-[0.07em] text-slate-100"
              >
                {section.title}
              </h2>
            </div>
            <div className="mt-4">
              <PrimerSectionBody section={section} />
            </div>
          </section>
        ))}

        <Panel className="border-mango-500/35 bg-mango-500/[0.05] p-5">
          <p className="text-sm leading-6 text-slate-200">
            Nothing here is scored, and nothing is timed. When a step stops making sense, open the
            Guidance tab — it escalates from a nudge to the exact command, and reaching for it costs
            you nothing.
          </p>
        </Panel>
      </div>
    </SceneShell>
  );
}
