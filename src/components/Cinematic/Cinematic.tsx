'use client';

import {
  forwardRef,
  useEffect,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type HTMLAttributes,
  type ReactNode,
} from 'react';
import { cn } from '@/lib/cn';
import type { ObjectiveStep, Stage } from '@/content/types';
import { isChoiceVisible } from '@/engine/conditions';

type Tone = 'neutral' | 'action' | 'established' | 'compromised';

export function AppFrame({ message = 'Preparing operations console' }: { message?: string }) {
  return (
    <main className="app-shell grid place-items-center px-8" aria-label="Operation Mango">
      <div className="w-full max-w-xl border border-white/10 bg-scene-raised/80 p-8 text-center">
        <BrandMark />
        <p className="mt-5 font-mono text-xs uppercase tracking-[0.24em] text-slate-400" role="status">
          {message}
        </p>
      </div>
    </main>
  );
}

export function BrandMark({ compact = false }: { compact?: boolean }) {
  return (
    <div
      className={cn('inline-flex items-center', compact ? 'gap-2' : 'gap-3')}
      aria-label="Operation Mango"
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 48 48"
        className={cn('text-mango-500', compact ? 'h-7 w-7' : 'h-11 w-11')}
      >
        <path
          d="M27 7c9 1 15 8 14 17-1 10-9 18-19 17C12 40 6 32 7 23 8 13 17 6 27 7Z"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        />
        <path d="M24 8c1-4 4-6 9-6-1 4-4 7-9 6Z" fill="currentColor" />
        <path d="M17 29 24 16l7 13H17Z" fill="currentColor" opacity=".28" />
      </svg>
      <span>
        <span className="block font-display text-2xl font-bold uppercase leading-none tracking-[0.16em] text-slate-100">
          Operation
        </span>
        <span className="block font-display text-lg font-bold uppercase leading-none tracking-[0.34em] text-mango-500">
          Mango
        </span>
      </span>
    </div>
  );
}

export function DesktopGate({ children }: { children: ReactNode }) {
  const [isDesktop, setIsDesktop] = useState<boolean | null>(null);

  useEffect(() => {
    const query = window.matchMedia('(min-width: 1024px)');
    const update = () => setIsDesktop(query.matches);
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);

  if (isDesktop === null) return <AppFrame />;

  if (!isDesktop) {
    return (
      <main className="app-shell grid place-items-center px-8" aria-label="Desktop access required">
        <Panel className="max-w-xl p-8 text-center">
          <BrandMark />
          <h1 className="mt-8 font-display text-3xl font-bold uppercase tracking-[0.12em] text-slate-100">
            Larger screen required
          </h1>
          <p className="mt-4 text-base leading-7 text-slate-300">
            This operations console is designed for a keyboard and a display at least 1024 pixels wide.
          </p>
        </Panel>
      </main>
    );
  }

  return <>{children}</>;
}

export const Panel = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(function Panel(
  { className, ...props },
  ref
) {
  return (
    <div
      ref={ref}
      className={cn('border border-white/10 bg-scene-raised/90 shadow-panel', className)}
      {...props}
    />
  );
});

interface ActionButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'quiet' | 'danger';
}

export const ActionButton = forwardRef<HTMLButtonElement, ActionButtonProps>(function ActionButton(
  { className, variant = 'primary', type = 'button', ...props },
  ref
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cn(
        'inline-flex min-h-11 items-center justify-center border px-5 py-2 font-display text-sm font-bold uppercase tracking-[0.14em] transition-colors disabled:cursor-not-allowed disabled:opacity-45',
        variant === 'primary' &&
          'border-mango-500 bg-mango-500 text-scene-ink hover:bg-mango-300',
        variant === 'secondary' &&
          'border-mango-500/50 bg-mango-500/10 text-mango-300 hover:bg-mango-500/20',
        variant === 'quiet' && 'border-white/15 bg-white/[0.03] text-slate-300 hover:bg-white/[0.07]',
        variant === 'danger' &&
          'border-white/30 bg-white/10 text-slate-100 hover:bg-white/15',
        className
      )}
      {...props}
    />
  );
});

export function TabButton({ active, className, ...props }: ActionButtonProps & { active?: boolean }) {
  return (
    <ActionButton
      role="tab"
      aria-selected={active}
      variant="quiet"
      className={cn(
        'min-h-9 border-x-0 border-t-0 px-3 py-1 text-xs',
        active ? 'border-b-mango-500 text-mango-300' : 'border-b-transparent',
        className
      )}
      {...props}
    />
  );
}

export function StatusBadge({ children, tone = 'neutral' }: { children: ReactNode; tone?: Tone }) {
  return (
    <span
      className={cn(
        'inline-flex items-center border px-2 py-1 font-mono text-[10px] uppercase tracking-[0.16em]',
        tone === 'neutral' && 'border-white/15 bg-white/[0.04] text-slate-400',
        tone === 'action' && 'border-mango-500/35 bg-mango-500/10 text-mango-300',
        tone === 'established' && 'border-leaf-500/40 bg-leaf-500/10 text-leaf-300',
        tone === 'compromised' && 'border-blight-400/45 bg-blight-600/15 text-blight-400'
      )}
    >
      {children}
    </span>
  );
}

export function StageRail({ stages, activeIndex }: { stages: readonly Stage[]; activeIndex: number }) {
  return (
    <nav aria-label="Mission stages" className="flex items-center gap-1">
      {stages.map((stage, index) => (
        <div key={stage.id} className="flex min-w-0 flex-1 items-center gap-1">
          <span
            aria-current={index === activeIndex ? 'step' : undefined}
            className={cn(
              'flex h-7 min-w-7 items-center justify-center border font-mono text-[10px]',
              index < activeIndex && 'border-leaf-500/50 bg-leaf-500/10 text-leaf-300',
              index === activeIndex && 'border-mango-500 bg-mango-500/15 text-mango-300',
              index > activeIndex && 'border-white/10 text-slate-600'
            )}
            title={stage.title}
          >
            {index + 1}
            <span className="sr-only">: {stage.title}</span>
          </span>
          {index < stages.length - 1 && (
            <span className={cn('h-px flex-1', index < activeIndex ? 'bg-leaf-500/40' : 'bg-white/10')} />
          )}
        </div>
      ))}
    </nav>
  );
}

export function ObjectiveProgress({
  steps,
  facts,
  decisions,
}: {
  steps: readonly ObjectiveStep[];
  facts: readonly string[];
  decisions: Readonly<Record<string, string>>;
}) {
  const visible = steps.filter((step) => isChoiceVisible(step.visibleWhen, decisions));
  const complete = visible.filter((step) =>
    step.requiresFacts.every((fact) => facts.includes(fact))
  ).length;

  return (
    <div aria-label={`${complete} of ${visible.length} objectives complete`}>
      <div className="mb-2 flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.14em] text-slate-400">
        <span>Objective progress</span>
        <span>{complete}/{visible.length}</span>
      </div>
      <div className="h-1 bg-white/10">
        <div
          className="h-full bg-leaf-500 transition-[width]"
          style={{ width: `${visible.length ? (complete / visible.length) * 100 : 0}%` }}
        />
      </div>
    </div>
  );
}

export function Notice({
  title,
  children,
  tone = 'neutral',
}: {
  title: string;
  children: ReactNode;
  tone?: 'neutral' | 'error';
}) {
  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      className={cn(
        'border p-4',
        tone === 'error'
          ? 'border-white/25 bg-white/[0.06] text-slate-100'
          : 'border-white/10 bg-white/[0.03] text-slate-300'
      )}
    >
      <p className="font-display text-sm font-bold uppercase tracking-[0.12em]">{title}</p>
      <div className="mt-1 text-sm text-slate-400">{children}</div>
    </div>
  );
}

export function LiveFeedback({ children }: { children: ReactNode }) {
  return (
    <div className="sr-only" aria-live="polite" aria-atomic="true">
      {children}
    </div>
  );
}

export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(true);

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReduced(query.matches);
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);

  return reduced;
}

export function SceneShell({
  label,
  eyebrow,
  title,
  children,
  footer,
}: {
  label: string;
  eyebrow: string;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  const reducedMotion = usePrefersReducedMotion();

  useEffect(() => {
    headingRef.current?.focus();
  }, [title]);

  return (
    <main
      className={cn(
        'app-shell scene-atmosphere grid place-items-center overflow-y-auto px-8 py-10',
        !reducedMotion && 'scene-enter'
      )}
      aria-label={label}
      data-motion={reducedMotion ? 'reduced' : 'full'}
    >
      <section className="relative z-10 w-full max-w-4xl">
        <div className="mb-6 flex items-center justify-between border-b border-white/10 pb-4">
          <BrandMark compact />
          <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-slate-500">{eyebrow}</span>
        </div>
        <Panel className="relative overflow-hidden p-8 lg:p-12">
          <div aria-hidden="true" className="absolute inset-y-0 left-0 w-1 bg-mango-500" />
          <h1
            ref={headingRef}
            tabIndex={-1}
            data-scene-focus
            className="font-display text-4xl font-bold uppercase tracking-[0.08em] text-slate-50 lg:text-6xl"
          >
            {title}
          </h1>
          <div className="mt-8">{children}</div>
          {footer && <div className="mt-10 border-t border-white/10 pt-6">{footer}</div>}
        </Panel>
      </section>
    </main>
  );
}
