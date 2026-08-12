'use client';

import { useEffect, useMemo, useState } from 'react';
import type { LogEvent, QuerySuggestion, TimeRange } from '@/content/types';
import { executeQuery, parseQuery } from '@/engine/logQuery';
import { SearchBar } from './SearchBar';
import { TimeRangeSelect } from './TimeRangeSelect';
import { QueryChips } from './QueryChips';
import { ResultsTable } from './ResultsTable';
import { EventDetail } from './EventDetail';
import { Histogram } from './Histogram';

interface LogExplorerProps {
  /** Already filtered to what has arrived at the current stage. */
  events: LogEvent[];
  ranges: TimeRange[];
  timeRangeId: string;
  query: string;
  suggestions: QuerySuggestion[];
  hint?: string;
  pinnedIds: string[];
  onQueryChange: (query: string) => void;
  onTimeRangeChange: (rangeId: string) => void;
  onPin: (eventId: string) => void;
  onUnpin: (eventId: string) => void;
}

/** Consecutive empty searches before the stage hint is offered. */
const HINT_THRESHOLD = 2;

export function LogExplorer({
  events,
  ranges,
  timeRangeId,
  query,
  suggestions,
  hint,
  pinnedIds,
  onQueryChange,
  onTimeRangeChange,
  onPin,
  onUnpin,
}: LogExplorerProps) {
  const [draft, setDraft] = useState(query);
  // The results are derived from this, not directly from the `query` prop.
  // It is initialized from the prop and re-synced whenever the prop changes
  // externally (e.g. the parent resetting search on stage advance), but a
  // submission also updates it immediately, so filtering (and the empty-
  // streak count below) reacts to "last submitted query" without waiting
  // for a parent round-trip through props.
  const [submittedQuery, setSubmittedQuery] = useState(query);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [emptyStreak, setEmptyStreak] = useState(0);

  useEffect(() => {
    setSubmittedQuery(query);
  }, [query]);

  const range = ranges.find((candidate) => candidate.id === timeRangeId) ?? ranges[0];

  const parsed = useMemo(() => parseQuery(submittedQuery), [submittedQuery]);

  const result = useMemo(() => {
    if (!parsed.ok) return { events: [], unknownFields: [] };
    return executeQuery(parsed.ast, events, range);
  }, [parsed, events, range]);

  // A submitted search that returns nothing twice running means the
  // player is stuck rather than exploring, so offer the stage hint.
  useEffect(() => {
    if (!parsed.ok) return;
    setEmptyStreak((streak) => (result.events.length === 0 ? streak + 1 : 0));
  }, [parsed, result]);

  const selected = result.events.find((event) => event.id === selectedId) ?? null;

  function runQuery(next: string) {
    setDraft(next);
    setSelectedId(null);
    setSubmittedQuery(next);
    onQueryChange(next);
  }

  return (
    <section className="flex h-full flex-col gap-3" aria-label="log explorer">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <TimeRangeSelect ranges={ranges} value={timeRangeId} onChange={onTimeRangeChange} />
        {result.unknownFields.length > 0 && (
          <p data-testid="unknown-fields" className="font-mono text-xs text-mango-500">
            No events carry the field{result.unknownFields.length > 1 ? 's' : ''}:{' '}
            {result.unknownFields.join(', ')}
          </p>
        )}
      </div>

      <SearchBar
        value={draft}
        onChange={setDraft}
        onSubmit={() => runQuery(draft)}
        error={parsed.ok ? null : parsed.error}
        resultCount={result.events.length}
      />

      <QueryChips suggestions={suggestions} onSelect={runQuery} />

      {hint && emptyStreak >= HINT_THRESHOLD && (
        <p
          data-testid="hint"
          className="rounded border border-mango-500/30 bg-mango-900/50 p-3 text-xs leading-relaxed text-mango-300"
        >
          {hint}
        </p>
      )}

      {range && <Histogram events={result.events} range={range} />}

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 lg:grid-cols-[3fr_2fr]">
        <div className="min-h-0 overflow-y-auto rounded border border-mango-500/20 bg-black/40">
          <ResultsTable
            events={result.events}
            selectedId={selectedId}
            pinnedIds={pinnedIds}
            onSelect={setSelectedId}
          />
        </div>
        <div className="min-h-0 overflow-y-auto rounded border border-mango-500/20 bg-black/40">
          <EventDetail
            event={selected}
            isPinned={selected ? pinnedIds.includes(selected.id) : false}
            onPin={onPin}
            onUnpin={onUnpin}
          />
        </div>
      </div>
    </section>
  );
}
