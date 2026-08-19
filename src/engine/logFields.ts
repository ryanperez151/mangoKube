import type { LogEvent, LogSource } from '@/content/types';
import { fieldValue } from './logQuery';

export { fieldValue };

/** The pinned leading column. Never a member of `columnFields`. */
export const TIME_FIELD = 'time';

/** What the table shows before the analyst touches it — today's fixed layout. */
export const DEFAULT_COLUMN_FIELDS: string[] = ['source', 'message'];

/**
 * Fixed group order, matching the order the primer introduces the sources in,
 * so the panel and the reference material agree. Sources absent from the
 * catalog events are dropped rather than rendered empty.
 */
const SOURCE_ORDER: LogSource[] = ['k8s-audit', 'apiserver', 'edr', 'ci-cd'];

export interface FieldCatalogEntry {
  field: string;
  /** Sources that emit this field, in `SOURCE_ORDER`. */
  sources: LogSource[];
  /** Events in the current result set carrying the field. */
  count: number;
  /** `count` as a share of the whole result set, 0-1. */
  coverage: number;
}

export interface FieldCatalogGroup {
  /** The source that owns this group, or `'all'` for fields every source emits. */
  id: LogSource | 'all';
  label: string;
  fields: FieldCatalogEntry[];
}

export interface FieldValueSummary {
  value: string;
  count: number;
  /** Share of the events carrying this field, 0-1. */
  share: number;
}

/** `source` and `message` are promoted, so every event carries them. */
function eventFields(event: LogEvent): string[] {
  return ['source', 'message', ...Object.keys(event.fields)];
}

/**
 * Two inputs, deliberately: the catalog is built from everything the analyst
 * could see at this stage, so it stays still while a query is edited, while the
 * counts come from the current result set and move with every search. A field
 * that drops to zero stays listed and greys out — "this source has no such
 * field" is the lesson, and a vanishing row cannot teach it.
 */
export function buildFieldCatalog(
  catalogEvents: LogEvent[],
  resultEvents: LogEvent[]
): FieldCatalogGroup[] {
  const bySource = new Map<LogSource, Set<string>>();
  for (const event of catalogEvents) {
    const fields = bySource.get(event.source) ?? new Set<string>();
    for (const field of eventFields(event)) fields.add(field);
    bySource.set(event.source, fields);
  }

  const counts = new Map<string, number>();
  for (const event of resultEvents) {
    for (const field of eventFields(event)) {
      counts.set(field, (counts.get(field) ?? 0) + 1);
    }
  }

  const presentSources = SOURCE_ORDER.filter((source) => bySource.has(source));
  const total = resultEvents.length;

  function entryFor(field: string): FieldCatalogEntry {
    const count = counts.get(field) ?? 0;
    return {
      field,
      sources: presentSources.filter((source) => bySource.get(source)?.has(field)),
      count,
      coverage: total === 0 ? 0 : count / total,
    };
  }

  // Every field lands in exactly one group. One emitted by every source belongs
  // to none of them in particular; one emitted by several is filed under the
  // first, with `sources` recording the rest. Repeating `source` and `message`
  // under all four headings would put four identical controls on screen.
  const grouped = new Map<LogSource | 'all', FieldCatalogEntry[]>();
  const seen = new Set<string>();

  // Initialize empty arrays for all presentSources so every source gets a
  // group even if it has no unique fields. This lets the UI show that the
  // source exists and is just missing any distinctive fields.
  for (const source of presentSources) {
    grouped.set(source, []);
  }

  for (const source of presentSources) {
    for (const field of bySource.get(source) ?? []) {
      if (seen.has(field)) continue;
      seen.add(field);

      const entry = entryFor(field);
      const shared = presentSources.length > 1 && entry.sources.length === presentSources.length;
      const id: LogSource | 'all' = shared ? 'all' : source;
      grouped.set(id, [...(grouped.get(id) ?? []), entry]);
    }
  }

  const order: (LogSource | 'all')[] = ['all', ...presentSources];
  return order
    .filter((id) => grouped.has(id))
    .map((id) => ({
      id,
      label: id === 'all' ? 'All sources' : id,
      // Coverage descending — Splunk's own ranking, and it keeps the rarest
      // fields off the top of the list.
      fields: (grouped.get(id) ?? []).sort(
        (a, b) => b.count - a.count || a.field.localeCompare(b.field)
      ),
    }));
}

export function summarizeFieldValues(
  field: string,
  events: LogEvent[],
  limit = 10
): FieldValueSummary[] {
  const counts = new Map<string, number>();
  for (const event of events) {
    const value = fieldValue(event, field);
    if (value === undefined) continue;
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }

  const carrying = [...counts.values()].reduce((sum, count) => sum + count, 0);
  if (carrying === 0) return [];

  return [...counts.entries()]
    .map(([value, count]) => ({ value, count, share: count / carrying }))
    .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value))
    .slice(0, limit);
}
