'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { ColumnPreset, ColumnSort, LogEvent, TimeRange } from '@/content/types';
import { executeQuery, parseQuery } from '@/engine/logQuery';
import {
  applyValueFilter,
  buildFieldCatalog,
  moveColumnField,
  sortEvents,
  toggleColumnField,
  type ValueFilterMode,
} from '@/engine/logFields';
import { SearchBar } from './SearchBar';
import { TimeRangeSelect } from './TimeRangeSelect';
import { ResultsTable } from './ResultsTable';
import { Histogram } from './Histogram';
import { FieldPanel } from './FieldPanel';

interface LogExplorerProps {
  events: LogEvent[];
  ranges: TimeRange[];
  timeRangeId: string;
  query: string;
  columnFields: string[];
  columnSort: ColumnSort;
  fieldPanelPinned: boolean;
  presets: ColumnPreset[];
  pinnedIds: string[];
  selectedId: string | null;
  insertion?: { id: number; text: string };
  onQueryChange: (query: string) => void;
  onTimeRangeChange: (rangeId: string) => void;
  onColumnFieldsChange: (fields: string[]) => void;
  onColumnSortChange: (sort: ColumnSort) => void;
  onFieldPanelPinnedChange: (pinned: boolean) => void;
  onSelect: (eventId: string | null) => void;
  onFailedAttempt: () => void;
}

export function LogExplorer({
  events,
  ranges,
  timeRangeId,
  query,
  columnFields,
  columnSort,
  fieldPanelPinned,
  presets,
  pinnedIds,
  selectedId,
  insertion,
  onQueryChange,
  onTimeRangeChange,
  onColumnFieldsChange,
  onColumnSortChange,
  onFieldPanelPinnedChange,
  onSelect,
  onFailedAttempt,
}: LogExplorerProps) {
  const [draft, setDraft] = useState(query);
  const [panelOpen, setPanelOpen] = useState(false);
  const panelToggleRef = useRef<HTMLButtonElement>(null);
  // The edge tab that owns `panelToggleRef` only renders while the panel is
  // closed (see the `{!isPanelOpen && ...}` guard below), so at the moment
  // any close path runs, the tab is unmounted and the ref is null. Requesting
  // a restore here and acting on it in the effect below — which fires after
  // the close has committed and the tab has remounted — is what makes the
  // focus call land on a real node instead of nothing.
  const restoreFocus = useRef(false);

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

  const sorted = useMemo(() => sortEvents(result.events, columnSort), [result.events, columnSort]);
  const groups = useMemo(
    () => buildFieldCatalog(events, result.events),
    [events, result.events]
  );

  // Pinning is a promise the panel stays put; an overlay is dismissible.
  const isPanelOpen = fieldPanelPinned || panelOpen;

  useEffect(() => {
    if (!isPanelOpen && restoreFocus.current) {
      restoreFocus.current = false;
      panelToggleRef.current?.focus();
    }
  }, [isPanelOpen]);

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

  /**
   * Deliberately not routed through `runQuery`: a value click that narrows to
   * nothing is exploration, not a wrong hypothesis, and must never feed the
   * guidance escalation counter.
   */
  function filterByValue(field: string, value: string, mode: ValueFilterMode) {
    const next = applyValueFilter(query, field, value, mode);
    setDraft(next);
    onSelect(null);
    onQueryChange(next);
  }

  function closePanel() {
    restoreFocus.current = true;
    setPanelOpen(false);
    if (fieldPanelPinned) onFieldPanelPinnedChange(false);
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

      <div className="relative flex min-h-0 flex-1 gap-0">
        {!isPanelOpen && (
          <button
            ref={panelToggleRef}
            type="button"
            aria-label="Open field browser"
            aria-expanded={false}
            onClick={() => setPanelOpen(true)}
            className="flex w-7 shrink-0 items-center justify-center border border-r-0 border-white/10 bg-scene-raised/90 text-[10px] uppercase tracking-[0.18em] text-mango-300/70 hover:text-mango-300"
          >
            <span className="[writing-mode:vertical-rl]">Fields</span>
          </button>
        )}

        <FieldPanel
          open={isPanelOpen}
          pinned={fieldPanelPinned}
          groups={groups}
          resultEvents={result.events}
          selectedFields={columnFields}
          presets={presets}
          onToggleField={(field) => onColumnFieldsChange(toggleColumnField(columnFields, field))}
          onMoveField={(field, direction) =>
            onColumnFieldsChange(moveColumnField(columnFields, field, direction))
          }
          onApplyPreset={(preset) => {
            onColumnFieldsChange([...preset.fields]);
            if (!fieldPanelPinned) {
              restoreFocus.current = true;
              setPanelOpen(false);
            }
          }}
          onFilter={filterByValue}
          onTogglePinned={() => {
            // `fieldPanelPinned` here is the *current* (pre-toggle) value.
            // Pinning (current=false, about to become true): drop the
            // transient overlay state and rely on the `pinned` prop to keep
            // the panel open on the next render.
            // Unpinning (current=true, about to become false): the panel
            // must not vanish, so open the overlay state to take over.
            onFieldPanelPinnedChange(!fieldPanelPinned);
            setPanelOpen(fieldPanelPinned);
          }}
          onClose={closePanel}
        />

        <div
          data-testid="result-viewport"
          className="min-h-0 min-w-0 flex-1 overflow-y-auto border border-white/10 bg-black/35"
        >
          <ResultsTable
            events={sorted}
            columnFields={columnFields}
            sort={columnSort}
            selectedId={selectedId}
            pinnedIds={pinnedIds}
            onSelect={onSelect}
            onSortChange={onColumnSortChange}
            onColumnFieldsChange={onColumnFieldsChange}
          />
        </div>
      </div>
    </section>
  );
}
