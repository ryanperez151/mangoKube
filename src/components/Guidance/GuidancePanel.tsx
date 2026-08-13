'use client';

import { Fragment, type ReactNode } from 'react';
import type { CampaignPrimer, GuidanceStep } from '@/content/types';
import { ActionButton, StatusBadge } from '@/components/Cinematic/Cinematic';
import { PrimerSectionBody } from '@/components/Primer/Primer';

const TIER_LABEL: Record<number, string> = {
  1: 'Orient',
  2: 'Narrow it down',
  3: 'The exact answer',
};

/** Renders `backticked` spans as code so exact queries stay readable. */
function inlineCode(line: string): ReactNode {
  return line.split('`').map((part, index) =>
    index % 2 === 1 ? (
      <code key={index} className="break-words bg-black/40 px-1 font-mono text-[0.95em] text-mango-300">
        {part}
      </code>
    ) : (
      <Fragment key={index}>{part}</Fragment>
    )
  );
}

interface GuidancePanelProps {
  objective: string;
  /** Already filtered to the current decision route, ascending by level. */
  guidance: readonly GuidanceStep[];
  level: number;
  inputTarget: 'search' | 'terminal';
  primer?: CampaignPrimer;
  onReveal: () => void;
  onInsert: (text: string) => void;
  onReplayBriefing: () => void;
}

/**
 * Help as a panel rather than a modal: the player can read a hint and act on
 * it without dismissing anything. Tiers are revealed one deliberate click at
 * a time and stay on screen for the rest of the stage.
 */
export function GuidancePanel({
  objective,
  guidance,
  level,
  inputTarget,
  primer,
  onReveal,
  onInsert,
  onReplayBriefing,
}: GuidancePanelProps) {
  const revealed = guidance.filter((step) => step.level <= level);
  const maxLevel = guidance.reduce((highest, step) => Math.max(highest, step.level), 0);
  const hasMore = level < maxLevel;

  return (
    <div className="space-y-7">
      <section aria-label="Current objective">
        <StatusBadge>Objective</StatusBadge>
        <p className="mt-3 text-sm leading-6 text-slate-100">{objective}</p>
      </section>

      <section aria-label="Hints">
        <h3 className="mb-2 font-mono text-[10px] uppercase tracking-[0.18em] text-slate-400">
          Hints
        </h3>

        {revealed.length === 0 ? (
          <p className="text-xs leading-5 text-slate-400">
            Nothing revealed yet. Hints escalate from a nudge to the exact answer, and nothing here
            is scored.
          </p>
        ) : (
          <ol className="space-y-4">
            {revealed.map((step) => (
              <li key={step.level} data-testid={`guidance-tier-${step.level}`}>
                <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-mango-300">
                  Tier {step.level} · {TIER_LABEL[step.level] ?? 'Guidance'}
                </p>
                <div className="mt-2 space-y-2 border-l-2 border-mango-500/40 pl-3">
                  {step.lines.map((line, index) => (
                    <p key={index} className="text-sm leading-6 text-slate-300">
                      {inlineCode(line)}
                    </p>
                  ))}
                </div>
                {step.insertText && (
                  <ActionButton
                    variant="secondary"
                    className="mt-3 min-h-9 px-3 text-xs"
                    onClick={() => onInsert(step.insertText!)}
                  >
                    Insert into {inputTarget}
                  </ActionButton>
                )}
              </li>
            ))}
          </ol>
        )}

        <div className="mt-5 flex flex-wrap gap-2 border-t border-white/10 pt-4">
          {hasMore ? (
            <ActionButton className="min-h-9 px-3 text-xs" onClick={onReveal}>
              {revealed.length === 0 ? 'Reveal a hint' : 'Reveal the next hint'}
            </ActionButton>
          ) : (
            <p className="text-xs leading-5 text-slate-400">
              That is every hint for this stage.
            </p>
          )}
          <ActionButton variant="quiet" className="min-h-9 px-3 text-xs" onClick={onReplayBriefing}>
            Replay briefing
          </ActionButton>
        </div>
      </section>

      {primer && (
        <section aria-label="Reference">
          <h3 className="mb-2 font-mono text-[10px] uppercase tracking-[0.18em] text-slate-400">
            Reference
          </h3>
          <p className="mb-3 text-xs leading-5 text-slate-400">
            {primer.title} — the familiarization material, kept here so you never have to leave the
            console to look something up.
          </p>
          <div className="space-y-2">
            {primer.sections.map((section) => (
              <details
                key={section.id}
                className="group border border-white/10 bg-white/[0.02] open:bg-white/[0.04]"
              >
                <summary className="cursor-pointer list-none p-3 text-xs font-semibold text-slate-200 marker:content-[''] hover:text-mango-300">
                  <span aria-hidden="true" className="mr-2 inline-block text-slate-500 group-open:hidden">
                    +
                  </span>
                  <span aria-hidden="true" className="mr-2 hidden text-slate-500 group-open:inline-block">
                    −
                  </span>
                  {section.title}
                </summary>
                <div className="border-t border-white/10 p-3">
                  <PrimerSectionBody section={section} compact />
                </div>
              </details>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
