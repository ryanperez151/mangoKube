'use client';

import type { FieldValueSummary, ValueFilterMode } from '@/engine/logFields';

interface FieldValueListProps {
  field: string;
  values: FieldValueSummary[];
  onFilter: (field: string, value: string, mode: ValueFilterMode) => void;
}

const FILTER_BUTTON_CLASS =
  'px-1 font-mono text-xs leading-none text-mango-300/60 hover:text-mango-300';

/**
 * Explicit + and − rather than modifier-clicks: a modifier-click has no
 * keyboard equivalent, and this panel has to survive the axe sweep.
 */
export function FieldValueList({ field, values, onFilter }: FieldValueListProps) {
  if (values.length === 0) {
    return (
      <p data-testid="no-values" className="px-2 py-1 text-[11px] text-slate-500">
        No values in these results.
      </p>
    );
  }

  return (
    <ul className="space-y-1 py-1">
      {values.map((entry) => (
        <li key={entry.value} className="px-2">
          <div className="flex items-center gap-2">
            <span className="min-w-0 flex-1 truncate font-mono text-[11px] text-slate-200" title={entry.value}>
              {entry.value}
            </span>
            <span className="font-mono text-[11px] text-slate-500">{entry.count}</span>
            <button
              type="button"
              aria-label={`Filter to ${field}=${entry.value}`}
              onClick={() => onFilter(field, entry.value, 'include')}
              className={FILTER_BUTTON_CLASS}
            >
              +
            </button>
            <button
              type="button"
              aria-label={`Exclude ${field}=${entry.value}`}
              onClick={() => onFilter(field, entry.value, 'exclude')}
              className={FILTER_BUTTON_CLASS}
            >
              −
            </button>
          </div>
          <div className="mt-0.5 h-0.5 bg-white/5">
            <div
              data-testid={`share-${field}-${entry.value}`}
              className="h-full bg-mango-500/50"
              style={{ width: `${entry.share * 100}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}
