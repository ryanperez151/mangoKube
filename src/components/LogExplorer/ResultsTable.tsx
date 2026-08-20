'use client';

import { useEffect, useRef } from 'react';
import type { ColumnSort, LogEvent } from '@/content/types';
import { fieldValue, moveColumnField, removeColumnField, TIME_FIELD } from '@/engine/logFields';
import { cn } from '@/lib/cn';
import { ColumnHeaderMenu, type ColumnHeaderMenuHandle } from './ColumnHeaderMenu';

interface ResultsTableProps {
  events: LogEvent[];
  /** Selectable columns in order. Time is rendered separately and always. */
  columnFields: string[];
  sort: ColumnSort;
  selectedId: string | null;
  pinnedIds: string[];
  onSelect: (eventId: string) => void;
  onSortChange: (sort: ColumnSort) => void;
  onColumnFieldsChange: (fields: string[]) => void;
}

const SOURCE_LABEL_CLASS: Record<LogEvent['source'], string> = {
  'k8s-audit': 'text-mango-500',
  edr: 'text-slate-300',
  apiserver: 'text-leaf-300',
  'ci-cd': 'text-mango-300/70',
};

function formatTime(timestamp: string): string {
  return timestamp.replace('T', ' ').replace('Z', '');
}

function ariaSort(sort: ColumnSort, field: string): 'ascending' | 'descending' | 'none' {
  if (sort.field !== field) return 'none';
  return sort.direction === 'asc' ? 'ascending' : 'descending';
}

/**
 * Clicking a column that is not sorting yet starts ascending, except time,
 * which starts newest-first — that is how an incident feed is read.
 */
function nextSort(sort: ColumnSort, field: string): ColumnSort {
  if (sort.field === field) {
    return { field, direction: sort.direction === 'asc' ? 'desc' : 'asc' };
  }
  return { field, direction: field === TIME_FIELD ? 'desc' : 'asc' };
}

export function ResultsTable({
  events,
  columnFields,
  sort,
  selectedId,
  pinnedIds,
  onSelect,
  onSortChange,
  onColumnFieldsChange,
}: ResultsTableProps) {
  const menuRefs = useRef(new Map<string, ColumnHeaderMenuHandle>());
  const timeSortButtonRef = useRef<HTMLButtonElement>(null);
  // Set by `handleRemove`, read by the effect below once the removal has
  // actually committed — the index has to be captured before the field
  // disappears from `columnFields`, since that's the only moment "which
  // column was this" is still answerable.
  const pendingRemovalIndex = useRef<number | null>(null);

  // `ColumnHeaderMenu.act` focuses its own trigger before this fires (see the
  // comment on `closeAndRestoreFocus` there), but for a removal that trigger
  // is gone a moment later along with its `<th>`. This runs after the DOM
  // has already settled on the post-removal layout, so it's the one whose
  // focus placement actually survives: the column that slid into the removed
  // one's slot, or the one that's now last, or — if that was the only
  // selected column — the pinned Time sort button.
  useEffect(() => {
    const index = pendingRemovalIndex.current;
    if (index === null) return;
    pendingRemovalIndex.current = null;

    const neighborField = columnFields[index] ?? columnFields[index - 1];
    if (neighborField) {
      menuRefs.current.get(neighborField)?.focusTrigger();
    } else {
      timeSortButtonRef.current?.focus();
    }
  }, [columnFields]);

  function handleRemove(removedField: string) {
    pendingRemovalIndex.current = columnFields.indexOf(removedField);
    onColumnFieldsChange(removeColumnField(columnFields, removedField));
  }

  if (events.length === 0) {
    return (
      <p data-testid="empty-results" className="p-6 text-center font-mono text-xs text-mango-300/80">
        No events match this search in this time range.
        <br />
        Try removing a filter, or widening the time range.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-left font-mono text-xs">
        <thead className="sticky top-0 bg-orchard-900/95 text-mango-300/80">
          <tr>
            <th scope="col" className="w-8 px-2 py-2 font-normal">
              <span className="sr-only">Inspect</span>
            </th>
            <th scope="col" aria-sort={ariaSort(sort, TIME_FIELD)} className="px-3 py-2 font-normal">
              <button
                ref={timeSortButtonRef}
                type="button"
                aria-label="Sort by time"
                onClick={() => onSortChange(nextSort(sort, TIME_FIELD))}
                className="inline-flex h-6 items-center hover:text-mango-300"
              >
                Time
                {sort.field === TIME_FIELD && (
                  <span aria-hidden="true" className="ml-1 text-mango-500">
                    {sort.direction === 'asc' ? '▲' : '▼'}
                  </span>
                )}
              </button>
            </th>
            {columnFields.map((field, index) => (
              <th
                key={field}
                scope="col"
                aria-sort={ariaSort(sort, field)}
                className="whitespace-nowrap px-3 py-2 font-normal"
              >
                <button
                  type="button"
                  aria-label={`Sort by ${field}`}
                  onClick={() => onSortChange(nextSort(sort, field))}
                  className="inline-flex h-6 items-center hover:text-mango-300"
                >
                  {field}
                  {sort.field === field && (
                    <span aria-hidden="true" className="ml-1 text-mango-500">
                      {sort.direction === 'asc' ? '▲' : '▼'}
                    </span>
                  )}
                </button>
                <ColumnHeaderMenu
                  ref={(instance) => {
                    if (instance) menuRefs.current.set(field, instance);
                    else menuRefs.current.delete(field);
                  }}
                  field={field}
                  index={index}
                  total={columnFields.length}
                  onMove={(moved, direction) =>
                    onColumnFieldsChange(moveColumnField(columnFields, moved, direction))
                  }
                  onRemove={handleRemove}
                />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {events.map((event) => {
            const isSelected = event.id === selectedId;
            const isPinned = pinnedIds.includes(event.id);
            return (
              <tr
                key={event.id}
                data-testid={`row-${event.id}`}
                data-selected={isSelected}
                data-pinned={isPinned}
                onClick={() => onSelect(event.id)}
                className={cn(
                  'cursor-pointer border-t border-mango-500/10 hover:bg-white/[0.04]',
                  isSelected && 'bg-mango-500/15',
                  !isSelected && isPinned && 'bg-leaf-500/10'
                )}
              >
                {/* The keyboard path to selection. Its accessible name carries the
                    message so a row stays identifiable once that column is gone. */}
                <td className="px-2 py-1.5">
                  <button
                    type="button"
                    aria-label={`Inspect ${event.message}`}
                    onClick={(clicked) => {
                      clicked.stopPropagation();
                      onSelect(event.id);
                    }}
                    className={cn(
                      'block leading-none',
                      isPinned ? 'text-leaf-300' : 'text-mango-300/30 hover:text-mango-300'
                    )}
                  >
                    <span aria-hidden="true">{isPinned ? '●' : '○'}</span>
                  </button>
                </td>
                <td className="whitespace-nowrap px-3 py-1.5 text-mango-300/80">
                  {formatTime(event.timestamp)}
                </td>
                {columnFields.map((field) => {
                  const value = fieldValue(event, field);
                  return (
                    <td
                      key={field}
                      title={value}
                      className={cn(
                        'max-w-[28rem] truncate px-3 py-1.5',
                        field === 'source' && SOURCE_LABEL_CLASS[event.source],
                        field !== 'source' && (value === undefined ? 'text-slate-600' : 'text-mango-100')
                      )}
                    >
                      {value ?? '—'}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
