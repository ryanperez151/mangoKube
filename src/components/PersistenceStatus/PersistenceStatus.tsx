'use client';

import { useRouter } from 'next/navigation';
import { usePersistenceStatus } from '@/engine/persistence';
import { useSimStore } from '@/engine/store';
import { ActionButton } from '@/components/Cinematic/Cinematic';
import { cn } from '@/lib/cn';

export function PersistenceStatusNotice({
  placement = 'overlay',
  className,
}: {
  placement?: 'overlay' | 'inline';
  className?: string;
}) {
  const router = useRouter();
  const status = usePersistenceStatus();
  const resetProgress = useSimStore((state) => state.resetProgress);

  if (status.kind === 'ready') return null;

  function reset() {
    resetProgress();
    router.push('/campaign-select');
  }

  return (
    <aside
      role="status"
      className={cn(
        'z-40 border border-mango-500/40 bg-scene-ink/95 shadow-panel',
        placement === 'overlay'
          ? 'fixed right-4 top-4 max-w-sm p-4'
          : 'relative flex shrink-0 items-center gap-4 px-4 py-2',
        className
      )}
    >
      <div className="min-w-0 flex-1">
        <p className="font-display text-sm font-bold uppercase tracking-[0.12em] text-mango-300">
          {status.kind === 'memory' ? 'Memory-only session' : 'Progress recovery'}
        </p>
        <p className="mt-1 text-sm leading-6 text-slate-300">{status.message}</p>
      </div>
      {status.kind !== 'memory' && (
        <ActionButton variant="secondary" className={cn('min-h-9 shrink-0 px-3 text-xs', placement === 'overlay' && 'mt-3')} onClick={reset}>
          Reset Progress
        </ActionButton>
      )}
    </aside>
  );
}
