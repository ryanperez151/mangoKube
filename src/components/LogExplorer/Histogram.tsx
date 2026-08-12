'use client';

import type { LogEvent, TimeRange } from '@/content/types';

interface HistogramProps {
  events: LogEvent[];
  range: TimeRange;
}

const BUCKET_COUNT = 32;

/**
 * Event volume over the selected window. Purely orienting — it shows
 * where activity clusters so the player can see that 02:14 is busier
 * than it should be.
 */
export function Histogram({ events, range }: HistogramProps) {
  const start = Date.parse(range.startIso);
  const span = Math.max(Date.parse(range.endIso) - start, 1);
  const buckets = new Array<number>(BUCKET_COUNT).fill(0);

  for (const event of events) {
    const offset = (Date.parse(event.timestamp) - start) / span;
    if (offset < 0 || offset >= 1) continue;
    buckets[Math.floor(offset * BUCKET_COUNT)] += 1;
  }

  const peak = Math.max(...buckets, 1);

  return (
    <div
      role="img"
      aria-label={`Event volume across ${range.label.toLowerCase()}: ${events.length} events`}
      className="flex h-12 items-end gap-px"
    >
      {buckets.map((count, index) => (
        <div
          key={index}
          className="flex-1 bg-mango-500/50"
          style={{ height: `${Math.max((count / peak) * 100, count > 0 ? 6 : 1)}%` }}
        />
      ))}
    </div>
  );
}
