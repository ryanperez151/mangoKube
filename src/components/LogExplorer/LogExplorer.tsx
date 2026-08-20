'use client';

import { useEffect, useMemo, useState } from 'react';
import type { ColumnSort, LogEvent, TimeRange } from '@/content/types';
import { executeQuery, parseQuery } from '@/engine/logQuery';
import { DEFAULT_COLUMN_FIELDS, DEFAULT_COLUMN_SORT, sortEvents } from '@/engine/logFields';
import { SearchBar } from './SearchBar';
import { TimeRangeSelect } from './TimeRangeSelect';
import { ResultsTable } from './ResultsTable';
import { Histogram } from './Histogram';

interface LogExplorerProps {
  events: LogEvent[];
  ranges: TimeRange[];
  timeRangeId: string;
  query: string;
  pinnedIds: string[];
  selectedId: string | null;
  insertion?: { id: number; text: string };
  onQueryChange: (query: string) => void;
  onTimeRangeChange: (rangeId: string) => void;
  onSelect: (eventId: string | null) => void;
  onFailedAttempt: () => void;
}

export function LogExplorer({
  events,
  ranges,
  timeRangeId,
  query,
  pinnedIds,
  selectedId,
  insertion,
  onQueryChange,
  onTimeRangeChange,
  onSelect,
  onFailedAttempt,
}: LogExplorerProps) {
  const [draft, setDraft] = useState(query);
  // Local for now: the persisted layout (store's columnFields/columnSort) and the
  // field-picker flyout land in the LogExplorer-wiring task. Until then this keeps
  // the table's contract satisfied with the same source/message/time-desc layout
  // it always rendered.
  const [columnFields, setColumnFields] = useState<string[]>(DEFAULT_COLUMN_FIELDS);
  const [sort, setSort] = useState<ColumnSort>(DEFAULT_COLUMN_SORT);

  useEffect(() => setDraft(query), [query]);

  useEffect(() => {
    if (insertion) setDraft(insertion.text);
  }, [insertion]);

  const range = ranges.find((candidate) => candidate.id === timeRangeId) ?? ranges[0];
  const parsed = useMemo(() => parseQuery(query), [query]);
  const result = useMemo(() => {
    if (!parsed.ok) return { events: [], unknownFields: [] };
    return executeQuery(parsed.ast, events, range);
  }, [parsed, events, range]);
  const sortedEvents = useMemo(() => sortEvents(result.events, sort), [result.events, sort]);

  function runQuery() {
    onSelect(null);
    onQueryChange(draft);
    const submitted = parseQuery(draft);
    if (!submitted.ok) {
      onFailedAttempt();
      return;
    }
    const outcome = executeQuery(submitted.ast, events, range);
    if (outcome.events.length === 0 || outcome.unknownFields.length > 0) onFailedAttempt();
  }

  return (
    <section className="flex h-full min-h-0 flex-col gap-3" aria-label="log explorer">
      <div className="flex flex-wrap items-center gap-3">
        <TimeRangeSelect
          ranges={ranges}
          value={timeRangeId}
          onChange={(rangeId) => {
            onSelect(null);
            onTimeRangeChange(rangeId);
          }}
        />
        <div className="min-w-0 flex-1">
          <SearchBar
            value={draft}
            onChange={setDraft}
            onSubmit={runQuery}
            error={parsed.ok ? null : parsed.error}
            resultCount={result.events.length}
          />
        </div>
      </div>

      {result.unknownFields.length > 0 && (
        <p data-testid="unknown-fields" className="font-mono text-xs text-mango-300">
          No events carry the field{result.unknownFields.length > 1 ? 's' : ''}:{' '}
          {result.unknownFields.join(', ')}
        </p>
      )}

      {range && <Histogram events={result.events} range={range} />}

      <div
        data-testid="result-viewport"
        className="min-h-0 flex-1 overflow-y-auto border border-white/10 bg-black/35"
      >
        <ResultsTable
          events={sortedEvents}
          columnFields={columnFields}
          sort={sort}
          selectedId={selectedId}
          pinnedIds={pinnedIds}
          onSelect={onSelect}
          onSortChange={setSort}
          onColumnFieldsChange={setColumnFields}
        />
      </div>
    </section>
  );
}
