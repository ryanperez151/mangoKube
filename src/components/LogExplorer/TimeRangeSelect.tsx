'use client';

import type { TimeRange } from '@/content/types';

interface TimeRangeSelectProps {
  ranges: TimeRange[];
  value: string;
  onChange: (rangeId: string) => void;
}

export function TimeRangeSelect({ ranges, value, onChange }: TimeRangeSelectProps) {
  return (
    <label className="flex items-center gap-2 text-xs uppercase tracking-wider text-mango-300/80">
      Time range
      <select
        aria-label="time range"
        className="rounded border border-mango-500/30 bg-black/50 px-2 py-1 font-mono text-xs text-mango-100 outline-none"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        {ranges.map((range) => (
          <option key={range.id} value={range.id}>
            {range.label}
          </option>
        ))}
      </select>
    </label>
  );
}
