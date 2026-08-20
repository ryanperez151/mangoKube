import type { ColumnSort, LogEvent, LogSource } from '@/content/types';
import { fieldValue, scanTokens } from './logQuery';

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

export type ValueFilterMode = 'include' | 'exclude';

/** Newest-first, matching what `executeQuery` already returns. */
export const DEFAULT_COLUMN_SORT: ColumnSort = { field: TIME_FIELD, direction: 'desc' };

export function sortEvents(events: LogEvent[], sort: ColumnSort): LogEvent[] {
  const factor = sort.direction === 'asc' ? 1 : -1;

  return [...events].sort((a, b) => {
    if (sort.field === TIME_FIELD) {
      return (Date.parse(a.timestamp) - Date.parse(b.timestamp)) * factor;
    }

    const left = fieldValue(a, sort.field);
    const right = fieldValue(b, sort.field);
    // A row that lacks the field sorts last whichever way the column points:
    // "no value" is not smaller than "a value", it is absent.
    if (left === undefined && right === undefined) return 0;
    if (left === undefined) return 1;
    if (right === undefined) return -1;

    const compared = left.toLowerCase().localeCompare(right.toLowerCase());
    if (compared !== 0) return compared * factor;
    return Date.parse(b.timestamp) - Date.parse(a.timestamp);
  });
}

interface ParsedToken {
  field: string;
  value: string;
  negated: boolean;
}

/** Uses the already-unescaped value `scanTokens` produced — no quote-stripping left to do here. */
function parseToken(token: string): ParsedToken | null {
  const negated = token.startsWith('-');
  const body = negated ? token.slice(1) : token;
  const equalsAt = body.indexOf('=');
  if (equalsAt <= 0) return null;

  const value = body.slice(equalsAt + 1);
  if (!value) return null;
  return { field: body.slice(0, equalsAt), value, negated };
}

/**
 * Escapes `"` and `\` before quoting so a value that carries its own quotes
 * (an RBAC decision naming a resource in quotes, say) survives being scanned
 * back out by `scanTokens` instead of prematurely closing the run.
 */
function formatToken(field: string, value: string, mode: ValueFilterMode): string {
  const needsQuotes = /[\s"\\]/.test(value);
  const body = needsQuotes ? `"${value.replace(/[\\"]/g, '\\$&')}"` : value;
  return `${mode === 'exclude' ? '-' : ''}${field}=${body}`;
}

/**
 * At most one predicate per field survives. Splunk would AND a second value of
 * the same field and return nothing, which reads as a broken panel rather than
 * a lesson; replacing is what every modern SIEM does. Clicking the predicate
 * already in play toggles it back off.
 */
export function applyValueFilter(
  query: string,
  field: string,
  value: string,
  mode: ValueFilterMode
): string {
  const scanned = scanTokens(query);
  // An unterminated quote is a query `parseQuery` already rejects — there is
  // no salvageable text to append the click to, so start clean instead of
  // building on top of text the player can't currently run.
  if (scanned === null) return formatToken(field, value, mode);

  const tokens = scanned.map((token) => ({ raw: token.raw, parsed: parseToken(token.value) }));
  type Entry = (typeof tokens)[number];
  const isMatch = (entry: Entry): entry is Entry & { parsed: ParsedToken } =>
    entry.parsed !== null && entry.parsed.field === field;

  const existing = tokens.find(isMatch)?.parsed;
  const others = tokens.filter((entry) => !isMatch(entry)).map(({ raw }) => raw);

  const isToggleOff =
    existing !== undefined &&
    existing.value === value &&
    existing.negated === (mode === 'exclude');

  const next = isToggleOff ? others : [...others, formatToken(field, value, mode)];
  return next.join(' ');
}

export function toggleColumnField(fields: string[], field: string): string[] {
  return fields.includes(field) ? fields.filter((name) => name !== field) : [...fields, field];
}

export function moveColumnField(fields: string[], field: string, direction: -1 | 1): string[] {
  const index = fields.indexOf(field);
  const target = index + direction;
  if (index === -1 || target < 0 || target >= fields.length) return fields;

  const next = [...fields];
  next[index] = next[target];
  next[target] = field;
  return next;
}

export function removeColumnField(fields: string[], field: string): string[] {
  return fields.filter((name) => name !== field);
}
