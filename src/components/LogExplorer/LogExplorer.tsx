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
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [emptyStreak, setEmptyStreak] = useState(0);

  // A parent may change `query` on its own — restoring a persisted query,
  // or resetting between stages. The visible input must follow it.
  useEffect(() => {
    setDraft(query);
  }, [query]);

  const range = ranges.find((candidate) => candidate.id === timeRangeId) ?? ranges[0];

  const parsed = useMemo(() => parseQuery(query), [query]);

  const result = useMemo(() => {
    if (!parsed.ok) return { events: [], unknownFields: [] };
    return executeQuery(parsed.ast, events, range);
  }, [parsed, events, range]);

  const selected = result.events.find((event) => event.id === selectedId) ?? null;

  function runQuery(next: string) {
    setDraft(next);
    setSelectedId(null);
    onQueryChange(next);

    // The streak counts submissions, so it is updated here rather than in
    // an effect. An effect keyed on memoized results would miscount three
    // ways: it fires once at mount before the player has searched, it does
    // not fire at all when the same failing query is resubmitted (the memo
    // inputs are unchanged), and it re-fires on unrelated re-renders when a
    // parent passes a freshly-built `events` array.
    const submitted = parseQuery(next);
    if (!submitted.ok) return;
    const outcome = executeQuery(submitted.ast, events, range);
    setEmptyStreak((streak) => (outcome.events.length === 0 ? streak + 1 : 0));
  }

  return (
    <section className="flex h-full flex-col gap-3" aria-label="log explorer">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <TimeRangeSelect
          ranges={ranges}
          value={timeRangeId}
          onChange={(rangeId) => {
            setEmptyStreak(0);
            onTimeRangeChange(rangeId);
          }}
        />
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
