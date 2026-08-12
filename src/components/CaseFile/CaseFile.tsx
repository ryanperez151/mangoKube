'use client';

import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import type { Fact, LogEvent } from '@/content/types';

interface CaseFileProps {
  objective: string;
  pinnedEvents: LogEvent[];
  facts: Fact[];
  onUnpin: (eventId: string) => void;
}

export function CaseFile({ objective, pinnedEvents, facts, onUnpin }: CaseFileProps) {
  const reduceMotion = useReducedMotion();

  return (
    <section aria-label="case file" className="flex h-full flex-col gap-4 overflow-y-auto">
      <div>
        <h2 className="text-[10px] uppercase tracking-widest text-mango-500">Objective</h2>
        <p data-testid="objective" className="text-sm leading-relaxed text-mango-100">
          {objective}
        </p>
      </div>

      {facts.length > 0 && (
        <div>
          <h2 className="mb-2 text-[10px] uppercase tracking-widest text-mango-500">Established</h2>
          <ul className="space-y-2">
            {facts.map((fact) => (
              <li key={fact.id} className="border-l-2 border-leaf-500/60 pl-3">
                <p className="text-xs font-semibold text-leaf-300">{fact.label}</p>
                <p className="text-xs leading-relaxed text-mango-300/80">{fact.detail}</p>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div>
        <h2 className="mb-2 text-[10px] uppercase tracking-widest text-mango-500">
          Pinned evidence
        </h2>
        {pinnedEvents.length === 0 ? (
          <p data-testid="empty-case-file" className="text-xs leading-relaxed text-mango-300/50">
            Nothing pinned yet. When a log line looks wrong, pin it here — including the ones that
            turn out to be routine. Ruling evidence out is part of the work.
          </p>
        ) : (
          <ul className="space-y-3">
            <AnimatePresence initial={false}>
              {pinnedEvents.map((event) => (
                <motion.li
                  key={event.id}
                  layout={!reduceMotion}
                  initial={reduceMotion ? false : { opacity: 0, x: 24 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={reduceMotion ? { opacity: 0 } : { opacity: 0, x: 24 }}
                  transition={{ duration: reduceMotion ? 0 : 0.28, ease: 'easeOut' }}
                  className="rounded border border-mango-500/20 bg-orchard-900/60 p-3"
                >
                  <p className="font-mono text-[10px] text-mango-300/50">
                    {event.timestamp} · {event.source}
                  </p>
                  <p className="font-mono text-xs text-mango-100">{event.message}</p>
                  {event.analystNote && (
                    <p className="mt-2 text-xs leading-relaxed text-mango-300/80">
                      {event.analystNote}
                    </p>
                  )}
                  <button
                    type="button"
                    onClick={() => onUnpin(event.id)}
                    className="mt-2 text-[10px] uppercase tracking-wider text-mango-300/50 underline hover:text-mango-300"
                  >
                    Remove
                  </button>
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
        )}
      </div>
    </section>
  );
}
