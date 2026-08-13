'use client';

import type { LogEvent } from '@/content/types';

interface EventDetailProps {
  event: LogEvent | null;
  isPinned: boolean;
  onPin: (eventId: string) => void;
  onUnpin: (eventId: string) => void;
}

export function EventDetail({ event, isPinned, onPin, onUnpin }: EventDetailProps) {
  if (!event) {
    return (
      <p data-testid="no-selection" className="p-6 text-center text-xs text-mango-300/80">
        Select an event to inspect its fields.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3 p-4">
      <div>
        <p className="font-mono text-xs text-mango-300/80">{event.timestamp}</p>
        <p className="text-sm text-mango-100">{event.message}</p>
      </div>

      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 font-mono text-xs">
        <dt className="text-mango-300/80">source</dt>
        <dd className="break-all text-mango-300">{event.source}</dd>
        {Object.entries(event.fields).map(([field, value]) => (
          <div key={field} className="contents">
            <dt className="text-mango-300/80">{field}</dt>
            <dd className="break-all text-mango-300">{value}</dd>
          </div>
        ))}
      </dl>

      {isPinned ? (
        <>
          <p
            data-testid="analyst-note"
            className="border-l-2 border-mango-500/50 bg-mango-900/40 p-3 text-xs leading-relaxed text-mango-300"
          >
            {event.analystNote}
          </p>
          <button
            type="button"
            onClick={() => onUnpin(event.id)}
            className="self-start text-xs text-mango-300/80 underline hover:text-mango-300"
          >
            Remove from case file
          </button>
        </>
      ) : (
        <button
          type="button"
          onClick={() => onPin(event.id)}
          className="self-start rounded bg-mango-500/20 px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-mango-300 hover:bg-mango-500/30"
        >
          Pin to case file
        </button>
      )}
    </div>
  );
}
