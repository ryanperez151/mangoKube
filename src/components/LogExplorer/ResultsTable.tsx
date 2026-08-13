'use client';

import type { LogEvent } from '@/content/types';
import { cn } from '@/lib/cn';

interface ResultsTableProps {
  events: LogEvent[];
  selectedId: string | null;
  pinnedIds: string[];
  onSelect: (eventId: string) => void;
}

const SOURCE_LABEL_CLASS: Record<LogEvent['source'], string> = {
  'k8s-audit': 'text-mango-500',
  edr: 'text-blight-400',
  apiserver: 'text-leaf-300',
  'ci-cd': 'text-mango-300/70',
};

function formatTime(timestamp: string): string {
  return timestamp.replace('T', ' ').replace('Z', '');
}

export function ResultsTable({ events, selectedId, pinnedIds, onSelect }: ResultsTableProps) {
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
            <th scope="col" className="px-3 py-2 font-normal">
              Time
            </th>
            <th scope="col" className="px-3 py-2 font-normal">
              Source
            </th>
            <th scope="col" className="px-3 py-2 font-normal">
              Event
            </th>
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
                className={cn(
                  'border-t border-mango-500/10',
                  isSelected && 'bg-mango-500/15',
                  !isSelected && isPinned && 'bg-leaf-500/10'
                )}
              >
                <td className="whitespace-nowrap px-3 py-1.5 text-mango-300/80">
                  {formatTime(event.timestamp)}
                </td>
                <td className={cn('whitespace-nowrap px-3 py-1.5', SOURCE_LABEL_CLASS[event.source])}>
                  {event.source}
                </td>
                <td className="px-3 py-1.5">
                  <button
                    type="button"
                    onClick={() => onSelect(event.id)}
                    className="text-left text-mango-100 hover:underline"
                  >
                    {isPinned && (
                      <span aria-label="pinned" className="mr-1 text-leaf-300">
                        ●
                      </span>
                    )}
                    {event.message}
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
