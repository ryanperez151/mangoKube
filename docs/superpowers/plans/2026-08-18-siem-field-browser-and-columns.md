# SIEM Field Browser & Dynamic Columns Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the Sentinel's log explorer a left field-browser flyout and dynamic, sortable result columns, so an analyst shapes the table instead of reading a fixed three-column view one row at a time.

**Architecture:** A new pure engine module (`src/engine/logFields.ts`) derives a field catalog and value summaries from log events and owns every column-list transform, so all of it is unit-testable without React. Three new components (`FieldPanel`, `FieldValueList`, `ColumnHeaderMenu`) render it; `ResultsTable` is rewritten to render a dynamic column list; `LogExplorer` wires them together. Column layout lives in the zustand store and persists alongside the existing query and time range.

**Tech Stack:** Next.js 14 (app router, static export), React 18, TypeScript, zustand + persist middleware, Tailwind, Vitest + Testing Library, Playwright + axe for e2e.

## Global Constraints

- **No new dependencies.** Everything is client-side; there is no backend and no network call.
- **Spec:** `docs/superpowers/specs/2026-08-18-siem-field-browser-and-columns-design.md`.
- **Corpus widening is OUT OF SCOPE.** Do not edit `src/content/chapter1/logs/noise.ts` or `signal.ts`. The oracle leak documented in the spec ships knowingly. Do not add the field-overlap invariants to `corpus.test.ts`.
- **The Infiltrator campaign is untouched.** It has no `logCorpus` and never opens this surface.
- **Colours come from the existing Tailwind palette only:** `scene-*`, `orchard-*`, `mango-*`, `leaf-*`, `blight-*`, plus `slate-*` and `white/N`. No new palette entries.
- **Use `cn()` from `@/lib/cn`** for conditional class names, as every existing component does.
- **Every interactive control needs an accessible name.** `tests/e2e/accessibility.spec.ts` runs axe over the mission workspace and must stay green.
- **Time is a pinned leading column.** The string `'time'` is never a member of `columnFields`.
- **Test commands:** `npx vitest run <path>` for one file, `npm run test` for the suite. Vitest resolves `@/` to `src/`.
- **Commit after every task.** End commit messages with:
  `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`

---

## File Structure

**Created:**

| File | Responsibility |
| --- | --- |
| `src/engine/logFields.ts` | Field catalog, value summaries, event sorting, query-token rewriting, column-list transforms. Pure. |
| `src/engine/logFields.test.ts` | Unit tests for the above. |
| `src/content/chapter1/logs/columnPresets.ts` | The four curated column presets. |
| `src/content/chapter1/logs/columnPresets.test.ts` | Asserts every preset field exists in the corpus. |
| `src/components/LogExplorer/ColumnHeaderMenu.tsx` | Per-column move-left / move-right / remove menu. |
| `src/components/LogExplorer/ColumnHeaderMenu.test.tsx` | Tests for the above. |
| `src/components/LogExplorer/FieldValueList.tsx` | One field's top values with include/exclude controls. |
| `src/components/LogExplorer/FieldValueList.test.tsx` | Tests for the above. |
| `src/components/LogExplorer/FieldPanel.tsx` | The flyout itself. |
| `src/components/LogExplorer/FieldPanel.test.tsx` | Tests for the above. |

**Modified:**

| File | Change |
| --- | --- |
| `src/engine/logQuery.ts` | Export `fieldValue` so column rendering and predicates share one accessor. |
| `src/content/types.ts` | Add `ColumnPreset`, `SortDirection`, `ColumnSort`; add `Campaign.columnPresets`. |
| `src/content/chapter1/logs/index.ts` | Re-export `COLUMN_PRESETS`. |
| `src/content/chapter1/sentinel.ts` | Attach `columnPresets`. |
| `src/content/chapter1/primer.ts` | Add the "Building a table" section. |
| `src/engine/persistence.ts` | Persist and normalise the three new keys. |
| `src/engine/store.ts` | Three new state keys, three actions, `partialize`, `version: 3`. |
| `src/components/LogExplorer/ResultsTable.tsx` | Dynamic columns, sortable headers, selection gutter. |
| `src/components/LogExplorer/LogExplorer.tsx` | Own panel open state; wire columns and value filtering. |
| `src/app/mission/page.tsx` | Pass column state from the store into `LogExplorer`. |
| `src/components/LogExplorer/ResultsTable.test.tsx` | Updated for the new props. |
| `src/components/LogExplorer/LogExplorer.test.tsx` | Updated for the new props; value-click behaviour. |
| `src/engine/store.test.ts` | Tests for the three actions. |
| `tests/e2e/accessibility.spec.ts` | Axe case with the panel open. |

---

### Task 1: Field catalog and value summaries

**Files:**
- Modify: `src/engine/logQuery.ts:76`
- Create: `src/engine/logFields.ts`
- Test: `src/engine/logFields.test.ts`

**Interfaces:**
- Consumes: `LogEvent`, `LogSource` from `@/content/types`.
- Produces:
  - `export const TIME_FIELD = 'time'`
  - `export const DEFAULT_COLUMN_FIELDS: string[]` — `['source', 'message']`
  - `export function fieldValue(event: LogEvent, field: string): string | undefined` (re-exported from `logQuery`)
  - `export interface FieldCatalogEntry { field: string; sources: LogSource[]; count: number; coverage: number }`
  - `export interface FieldCatalogGroup { id: LogSource | 'all'; label: string; fields: FieldCatalogEntry[] }`

**Every field appears in exactly one group.** A field emitted by every present source goes to the `'all'` group ("All sources"); one emitted by several is filed under the first in source order, with `sources` recording the rest. Listing `source` and `message` under all four headings would put four identical controls on screen with identical accessible names.
  - `export interface FieldValueSummary { value: string; count: number; share: number }`
  - `export function buildFieldCatalog(catalogEvents: LogEvent[], resultEvents: LogEvent[]): FieldCatalogGroup[]`
  - `export function summarizeFieldValues(field: string, events: LogEvent[], limit?: number): FieldValueSummary[]`

- [ ] **Step 1: Export `fieldValue` from the query engine**

In `src/engine/logQuery.ts`, change the declaration at line 76 from `function fieldValue(` to `export function fieldValue(`, and extend its existing doc comment:

```ts
/**
 * `source` and `message` are promoted to queryable fields so players can
 * write `source=edr` without the content author duplicating them into
 * every event's `fields` bag.
 *
 * Exported because column rendering and field summaries read values through
 * this same accessor — one definition means a field can never become
 * queryable but not tableable, or the reverse.
 */
export function fieldValue(event: LogEvent, field: string): string | undefined {
```

- [ ] **Step 2: Write the failing test**

Create `src/engine/logFields.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { buildFieldCatalog, summarizeFieldValues } from './logFields';
import type { LogEvent } from '@/content/types';

const events: LogEvent[] = [
  {
    id: 'a1',
    timestamp: '2026-08-12T02:14:01Z',
    source: 'k8s-audit',
    message: 'create pods/exec',
    fields: { user: 'ci-deploy-bot', verb: 'create', responseCode: '201' },
    arrivesAtStage: 0,
  },
  {
    id: 'a2',
    timestamp: '2026-08-12T02:15:00Z',
    source: 'k8s-audit',
    message: 'get secrets/genome',
    fields: { user: 'ci-deploy-bot', verb: 'get', responseCode: '200' },
    arrivesAtStage: 0,
  },
  {
    id: 'a3',
    timestamp: '2026-08-12T02:16:00Z',
    source: 'k8s-audit',
    message: 'get configmaps/routing',
    fields: { user: 'route-planner', verb: 'get' },
    arrivesAtStage: 0,
  },
  {
    id: 'e1',
    timestamp: '2026-08-12T02:14:03Z',
    source: 'edr',
    message: 'Interactive shell spawned',
    fields: { pod: 'ci-deploy-bot-x2k1p', severity: 'high' },
    arrivesAtStage: 0,
  },
];

/** Three sources, so "shared by some" and "shared by all" are distinguishable. */
const threeSources: LogEvent[] = [
  {
    id: 's1',
    timestamp: '2026-08-12T02:00:00Z',
    source: 'k8s-audit',
    message: 'm1',
    fields: { shared: 'x', onlyAudit: 'y' },
    arrivesAtStage: 0,
  },
  {
    id: 's2',
    timestamp: '2026-08-12T02:00:01Z',
    source: 'apiserver',
    message: 'm2',
    fields: { shared: 'x' },
    arrivesAtStage: 0,
  },
  {
    id: 's3',
    timestamp: '2026-08-12T02:00:02Z',
    source: 'edr',
    message: 'm3',
    fields: { onlyEdr: 'z' },
    arrivesAtStage: 0,
  },
];

describe('buildFieldCatalog', () => {
  it('groups fields under the source that emits them', () => {
    const groups = buildFieldCatalog(events, events);
    const audit = groups.find((group) => group.id === 'k8s-audit');
    const edr = groups.find((group) => group.id === 'edr');

    expect(audit?.fields.map((entry) => entry.field)).toEqual(
      expect.arrayContaining(['user', 'verb', 'responseCode'])
    );
    expect(edr?.fields.map((entry) => entry.field)).toEqual(
      expect.arrayContaining(['pod', 'severity'])
    );
    expect(edr?.fields.some((entry) => entry.field === 'verb')).toBe(false);
  });

  it('collects fields every source emits into one group', () => {
    const groups = buildFieldCatalog(events, events);
    const all = groups.find((group) => group.id === 'all');

    expect(all?.label).toBe('All sources');
    expect(all?.fields.map((entry) => entry.field)).toEqual(['message', 'source']);
  });

  it('lists every field exactly once', () => {
    const fields = buildFieldCatalog(events, events).flatMap((group) =>
      group.fields.map((entry) => entry.field)
    );
    expect(new Set(fields).size).toBe(fields.length);
  });

  it('files a field shared by some sources under the first that emits it', () => {
    const groups = buildFieldCatalog(threeSources, threeSources);
    const audit = groups.find((group) => group.id === 'k8s-audit');
    const apiserver = groups.find((group) => group.id === 'apiserver');
    const shared = audit?.fields.find((entry) => entry.field === 'shared');

    expect(shared?.sources).toEqual(['k8s-audit', 'apiserver']);
    expect(apiserver?.fields.some((entry) => entry.field === 'shared')).toBe(false);
  });

  it('leads with the shared group, then sources in reading order', () => {
    const groups = buildFieldCatalog(threeSources, threeSources);
    expect(groups.map((group) => group.id)).toEqual(['all', 'k8s-audit', 'apiserver', 'edr']);
  });

  it('omits sources the catalog events do not contain', () => {
    const groups = buildFieldCatalog(events, events);
    expect(groups.map((group) => group.id)).toEqual(['all', 'k8s-audit', 'edr']);
  });

  it('counts coverage against the result set, not the catalog', () => {
    const narrowed = events.filter((event) => event.source === 'edr');
    const groups = buildFieldCatalog(events, narrowed);
    const audit = groups.find((group) => group.id === 'k8s-audit');
    const user = audit?.fields.find((entry) => entry.field === 'user');

    expect(user).toBeDefined();
    expect(user?.count).toBe(0);
    expect(user?.coverage).toBe(0);
  });

  it('reports coverage as a share of the whole result set', () => {
    const groups = buildFieldCatalog(events, events);
    const audit = groups.find((group) => group.id === 'k8s-audit');
    const responseCode = audit?.fields.find((entry) => entry.field === 'responseCode');

    expect(responseCode?.count).toBe(2);
    expect(responseCode?.coverage).toBeCloseTo(0.5);
  });

  it('orders fields by coverage descending, then alphabetically', () => {
    const groups = buildFieldCatalog(events, events);
    const audit = groups.find((group) => group.id === 'k8s-audit');
    const ordered = audit!.fields.map((entry) => entry.field);

    expect(ordered).toEqual(['user', 'verb', 'responseCode']);
  });

  it('survives an empty result set without dividing by zero', () => {
    const groups = buildFieldCatalog(events, []);
    for (const group of groups) {
      for (const entry of group.fields) {
        expect(entry.count).toBe(0);
        expect(entry.coverage).toBe(0);
      }
    }
  });
});

describe('summarizeFieldValues', () => {
  it('counts each value and sorts by count descending', () => {
    const summary = summarizeFieldValues('verb', events);
    expect(summary.map((entry) => entry.value)).toEqual(['get', 'create']);
    expect(summary[0].count).toBe(2);
  });

  it('reports share against events carrying the field', () => {
    const summary = summarizeFieldValues('verb', events);
    expect(summary[0].share).toBeCloseTo(2 / 3);
  });

  it('breaks count ties alphabetically so output is deterministic', () => {
    const summary = summarizeFieldValues('responseCode', events);
    expect(summary.map((entry) => entry.value)).toEqual(['200', '201']);
  });

  it('summarizes the promoted source field', () => {
    const summary = summarizeFieldValues('source', events);
    expect(summary.map((entry) => entry.value)).toEqual(['k8s-audit', 'edr']);
  });

  it('caps the list at the requested limit', () => {
    expect(summarizeFieldValues('message', events, 2)).toHaveLength(2);
  });

  it('returns nothing for a field no event carries', () => {
    expect(summarizeFieldValues('nope', events)).toEqual([]);
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npx vitest run src/engine/logFields.test.ts`
Expected: FAIL — `Failed to resolve import "./logFields"`.

- [ ] **Step 4: Implement the catalog module**

Create `src/engine/logFields.ts`:

```ts
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
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run src/engine/logFields.test.ts`
Expected: PASS — 16 tests.

- [ ] **Step 6: Confirm the `fieldValue` export broke nothing**

Run: `npx vitest run src/engine/logQuery.test.ts`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/engine/logFields.ts src/engine/logFields.test.ts src/engine/logQuery.ts
git commit -m "feat: derive a log field catalog with live coverage

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 2: Sorting, query rewriting, and column transforms

**Files:**
- Modify: `src/engine/logFields.ts`
- Modify: `src/content/types.ts`
- Test: `src/engine/logFields.test.ts`

**Interfaces:**
- Consumes: `TIME_FIELD`, `fieldValue` from Task 1.
- Produces:
  - `export type SortDirection = 'asc' | 'desc'` (in `types.ts`)
  - `export interface ColumnSort { field: string; direction: SortDirection }` (in `types.ts`)
  - `export type ValueFilterMode = 'include' | 'exclude'`
  - `export const DEFAULT_COLUMN_SORT: ColumnSort` — `{ field: 'time', direction: 'desc' }`
  - `export function sortEvents(events: LogEvent[], sort: ColumnSort): LogEvent[]`
  - `export function applyValueFilter(query: string, field: string, value: string, mode: ValueFilterMode): string`
  - `export function toggleColumnField(fields: string[], field: string): string[]`
  - `export function moveColumnField(fields: string[], field: string, direction: -1 | 1): string[]`
  - `export function removeColumnField(fields: string[], field: string): string[]`

- [ ] **Step 1: Add the column types**

In `src/content/types.ts`, append after the `QueryResult` interface:

```ts
export type SortDirection = 'asc' | 'desc';

export interface ColumnSort {
  /** A selectable field name, or `'time'` for the pinned leading column. */
  field: string;
  direction: SortDirection;
}

/** A one-click column layout. Never lists `time`, which is always present. */
export interface ColumnPreset {
  id: string;
  label: string;
  /** Selectable fields, in table order. */
  fields: string[];
}
```

- [ ] **Step 2: Write the failing test**

Append to `src/engine/logFields.test.ts` (keep the existing `events` fixture; add this import line to the top import from `./logFields`):

```ts
// Extend the existing import at the top of the file to:
// import {
//   applyValueFilter,
//   buildFieldCatalog,
//   moveColumnField,
//   removeColumnField,
//   sortEvents,
//   summarizeFieldValues,
//   toggleColumnField,
// } from './logFields';

describe('sortEvents', () => {
  it('sorts by time descending by default', () => {
    const sorted = sortEvents(events, { field: 'time', direction: 'desc' });
    expect(sorted.map((event) => event.id)).toEqual(['a3', 'a2', 'e1', 'a1']);
  });

  it('sorts by time ascending', () => {
    const sorted = sortEvents(events, { field: 'time', direction: 'asc' });
    expect(sorted.map((event) => event.id)).toEqual(['a1', 'e1', 'a2', 'a3']);
  });

  it('sorts a string field case-insensitively', () => {
    const sorted = sortEvents(events, { field: 'verb', direction: 'asc' });
    expect(sorted.slice(0, 3).map((event) => event.fields.verb)).toEqual([
      'create',
      'get',
      'get',
    ]);
  });

  it('puts events missing the field last in both directions', () => {
    const ascending = sortEvents(events, { field: 'severity', direction: 'asc' });
    const descending = sortEvents(events, { field: 'severity', direction: 'desc' });
    expect(ascending.at(-1)?.fields.severity).toBeUndefined();
    expect(descending.at(-1)?.fields.severity).toBeUndefined();
    expect(ascending[0].id).toBe('e1');
    expect(descending[0].id).toBe('e1');
  });

  it('breaks ties newest-first so order is stable', () => {
    const sorted = sortEvents(events, { field: 'verb', direction: 'asc' });
    expect(sorted.map((event) => event.id).slice(1, 3)).toEqual(['a3', 'a2']);
  });

  it('does not mutate its input', () => {
    const before = events.map((event) => event.id);
    sortEvents(events, { field: 'time', direction: 'asc' });
    expect(events.map((event) => event.id)).toEqual(before);
  });
});

describe('applyValueFilter', () => {
  it('appends a predicate to an empty query', () => {
    expect(applyValueFilter('', 'user', 'ci-deploy-bot', 'include')).toBe('user=ci-deploy-bot');
  });

  it('appends a predicate on a new field', () => {
    expect(applyValueFilter('source=edr', 'severity', 'high', 'include')).toBe(
      'source=edr severity=high'
    );
  });

  it('writes an exclusion with a leading dash', () => {
    expect(applyValueFilter('source=edr', 'severity', 'high', 'exclude')).toBe(
      'source=edr -severity=high'
    );
  });

  it('toggles an identical predicate off', () => {
    expect(applyValueFilter('source=edr severity=high', 'severity', 'high', 'include')).toBe(
      'source=edr'
    );
  });

  it('toggles an identical exclusion off', () => {
    expect(applyValueFilter('-severity=high', 'severity', 'high', 'exclude')).toBe('');
  });

  it('replaces a different value on the same field', () => {
    expect(applyValueFilter('source=edr severity=low', 'severity', 'high', 'include')).toBe(
      'source=edr severity=high'
    );
  });

  it('replaces when only the polarity differs', () => {
    expect(applyValueFilter('-severity=high', 'severity', 'high', 'include')).toBe(
      'severity=high'
    );
  });

  it('quotes a value containing whitespace', () => {
    expect(applyValueFilter('', 'message', 'create pods/exec', 'include')).toBe(
      'message="create pods/exec"'
    );
  });

  it('matches an existing quoted predicate when toggling off', () => {
    expect(
      applyValueFilter('message="create pods/exec"', 'message', 'create pods/exec', 'include')
    ).toBe('');
  });

  it('leaves bare search terms alone', () => {
    expect(applyValueFilter('genome source=edr', 'severity', 'high', 'include')).toBe(
      'genome source=edr severity=high'
    );
  });
});

describe('column field transforms', () => {
  it('adds a field to the end when toggled on', () => {
    expect(toggleColumnField(['source', 'message'], 'user')).toEqual([
      'source',
      'message',
      'user',
    ]);
  });

  it('removes a field when toggled off', () => {
    expect(toggleColumnField(['source', 'message'], 'message')).toEqual(['source']);
  });

  it('moves a field left', () => {
    expect(moveColumnField(['source', 'message', 'user'], 'user', -1)).toEqual([
      'source',
      'user',
      'message',
    ]);
  });

  it('moves a field right', () => {
    expect(moveColumnField(['source', 'message', 'user'], 'source', 1)).toEqual([
      'message',
      'source',
      'user',
    ]);
  });

  it('leaves the list alone at either edge', () => {
    expect(moveColumnField(['source', 'message'], 'source', -1)).toEqual(['source', 'message']);
    expect(moveColumnField(['source', 'message'], 'message', 1)).toEqual(['source', 'message']);
  });

  it('ignores a move for a field that is not selected', () => {
    expect(moveColumnField(['source', 'message'], 'user', -1)).toEqual(['source', 'message']);
  });

  it('removes a field', () => {
    expect(removeColumnField(['source', 'message', 'user'], 'message')).toEqual([
      'source',
      'user',
    ]);
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npx vitest run src/engine/logFields.test.ts`
Expected: FAIL — `sortEvents is not a function` (and the other new exports).

- [ ] **Step 4: Implement**

Append to `src/engine/logFields.ts`, and add `ColumnSort` to the type import at the top:

```ts
// Top of file — extend the existing type import to:
// import type { ColumnSort, LogEvent, LogSource } from '@/content/types';

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

/**
 * Splits a query into raw tokens, keeping quoted runs and their quotes intact.
 * Deliberately not `logQuery`'s tokenizer: that one strips quotes because it is
 * parsing, and this one is rewriting text the player will see and edit.
 */
function rawTokens(query: string): string[] {
  const tokens: string[] = [];
  let current = '';
  let inQuotes = false;

  for (const char of query) {
    if (char === '"') {
      inQuotes = !inQuotes;
      current += char;
      continue;
    }
    if (!inQuotes && /\s/.test(char)) {
      if (current) tokens.push(current);
      current = '';
      continue;
    }
    current += char;
  }

  if (current) tokens.push(current);
  return tokens;
}

function parseToken(token: string): ParsedToken | null {
  const negated = token.startsWith('-');
  const body = negated ? token.slice(1) : token;
  const equalsAt = body.indexOf('=');
  if (equalsAt <= 0) return null;

  const value = body.slice(equalsAt + 1).replace(/^"(.*)"$/, '$1');
  if (!value) return null;
  return { field: body.slice(0, equalsAt), value, negated };
}

function formatToken(field: string, value: string, mode: ValueFilterMode): string {
  const quoted = /\s/.test(value) ? `"${value}"` : value;
  return `${mode === 'exclude' ? '-' : ''}${field}=${quoted}`;
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
  const tokens = rawTokens(query);
  const existing = tokens
    .map(parseToken)
    .find((parsed): parsed is ParsedToken => parsed !== null && parsed.field === field);

  const others = tokens.filter((token) => {
    const parsed = parseToken(token);
    return parsed === null || parsed.field !== field;
  });

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
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run src/engine/logFields.test.ts`
Expected: PASS — 39 tests.

- [ ] **Step 6: Commit**

```bash
git add src/engine/logFields.ts src/engine/logFields.test.ts src/content/types.ts
git commit -m "feat: add column sorting, query rewriting, and column transforms

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 3: Curated column presets

**Files:**
- Create: `src/content/chapter1/logs/columnPresets.ts`
- Test: `src/content/chapter1/logs/columnPresets.test.ts`
- Modify: `src/content/types.ts`
- Modify: `src/content/chapter1/logs/index.ts:5`
- Modify: `src/content/chapter1/sentinel.ts:3,17`

**Interfaces:**
- Consumes: `ColumnPreset` from Task 2.
- Produces: `export const COLUMN_PRESETS: ColumnPreset[]`, and `Campaign.columnPresets?: ColumnPreset[]`.

- [ ] **Step 1: Write the failing test**

Create `src/content/chapter1/logs/columnPresets.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { COLUMN_PRESETS } from './columnPresets';
import { sentinelLogCorpus } from './index';

const corpusFields = new Set<string>([
  'source',
  'message',
  ...sentinelLogCorpus.flatMap((event) => Object.keys(event.fields)),
]);

describe('COLUMN_PRESETS', () => {
  it('only names fields the corpus can actually produce', () => {
    for (const preset of COLUMN_PRESETS) {
      for (const field of preset.fields) {
        expect(corpusFields.has(field), `preset "${preset.id}" names unknown field "${field}"`).toBe(
          true
        );
      }
    }
  });

  it('never lists the pinned time column', () => {
    for (const preset of COLUMN_PRESETS) {
      expect(preset.fields).not.toContain('time');
    }
  });

  it('uses unique ids', () => {
    const ids = COLUMN_PRESETS.map((preset) => preset.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('offers a default that matches the table before it is touched', () => {
    const fallback = COLUMN_PRESETS.find((preset) => preset.id === 'default');
    expect(fallback?.fields).toEqual(['source', 'message']);
  });

  it('never offers an empty layout', () => {
    for (const preset of COLUMN_PRESETS) {
      expect(preset.fields.length).toBeGreaterThan(0);
    }
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/content/chapter1/logs/columnPresets.test.ts`
Expected: FAIL — `Failed to resolve import "./columnPresets"`.

- [ ] **Step 3: Write the presets**

Create `src/content/chapter1/logs/columnPresets.ts`:

```ts
import type { ColumnPreset } from '@/content/types';

/**
 * Curated, not generated. "Every field this source carries" teaches nothing;
 * which handful of them a triage view needs is the thing worth handing a junior
 * analyst. Time is the pinned leading column and is never listed here.
 */
export const COLUMN_PRESETS: ColumnPreset[] = [
  {
    id: 'default',
    label: 'Default',
    fields: ['source', 'message'],
  },
  {
    id: 'audit-triage',
    label: 'Audit triage',
    fields: ['user', 'verb', 'resource', 'namespace', 'responseCode'],
  },
  {
    id: 'edr-triage',
    label: 'EDR triage',
    fields: ['pod', 'process', 'parent', 'severity'],
  },
  {
    id: 'api-authz',
    label: 'API authorization',
    fields: ['user', 'decision', 'status'],
  },
];
```

- [ ] **Step 4: Re-export from the logs barrel**

In `src/content/chapter1/logs/index.ts`, extend the existing re-export line:

```ts
export { TIME_RANGES, INCIDENT_NOW_ISO } from './timeRanges';
export { COLUMN_PRESETS } from './columnPresets';
```

- [ ] **Step 5: Add the campaign field**

In `src/content/types.ts`, inside `interface Campaign`, add below `timeRanges`:

```ts
  timeRanges?: TimeRange[];
  /** One-click column layouts for the log explorer. */
  columnPresets?: ColumnPreset[];
```

- [ ] **Step 6: Attach the presets to the Sentinel campaign**

In `src/content/chapter1/sentinel.ts`, change the logs import on line 3 and add the field after `timeRanges` on line 17:

```ts
import { COLUMN_PRESETS, sentinelLogCorpus, TIME_RANGES } from './logs';
```

```ts
  timeRanges: TIME_RANGES,
  columnPresets: COLUMN_PRESETS,
```

- [ ] **Step 7: Run the test to verify it passes**

Run: `npx vitest run src/content/chapter1/logs/columnPresets.test.ts`
Expected: PASS — 5 tests.

- [ ] **Step 8: Verify the content suite still passes**

Run: `npm run validate:content`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add src/content/chapter1/logs/columnPresets.ts src/content/chapter1/logs/columnPresets.test.ts src/content/chapter1/logs/index.ts src/content/chapter1/sentinel.ts src/content/types.ts
git commit -m "feat: add curated column presets for the log explorer

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 4: Persist the column layout

**Files:**
- Modify: `src/engine/persistence.ts`
- Modify: `src/engine/store.ts`
- Test: `src/engine/store.test.ts`

**Interfaces:**
- Consumes: `DEFAULT_COLUMN_FIELDS`, `DEFAULT_COLUMN_SORT`, `TIME_FIELD` from Tasks 1-2.
- Produces: store state `columnFields: string[]`, `columnSort: ColumnSort`, `fieldPanelPinned: boolean`; actions `setColumnFields(fields: string[]) => void`, `setColumnSort(sort: ColumnSort) => void`, `setFieldPanelPinned(pinned: boolean) => void`.

- [ ] **Step 1: Write the failing test**

Append to `src/engine/store.test.ts`. Every import these tests need is already at the top of that file — `useSimStore`, `normalizePersistedProgress`, and `sentinelCampaign`. Add nothing:

```ts
describe('column layout', () => {
  beforeEach(() => {
    useSimStore.getState().resetProgress();
    useSimStore.getState().startCampaign(sentinelCampaign);
  });

  it('starts on the layout the table has always shown', () => {
    expect(useSimStore.getState().columnFields).toEqual(['source', 'message']);
    expect(useSimStore.getState().columnSort).toEqual({ field: 'time', direction: 'desc' });
    expect(useSimStore.getState().fieldPanelPinned).toBe(false);
  });

  it('replaces the selected columns', () => {
    useSimStore.getState().setColumnFields(['user', 'verb']);
    expect(useSimStore.getState().columnFields).toEqual(['user', 'verb']);
  });

  it('accepts an empty column list', () => {
    useSimStore.getState().setColumnFields([]);
    expect(useSimStore.getState().columnFields).toEqual([]);
  });

  it('changes the sort', () => {
    useSimStore.getState().setColumnSort({ field: 'user', direction: 'asc' });
    expect(useSimStore.getState().columnSort).toEqual({ field: 'user', direction: 'asc' });
  });

  it('remembers whether the field panel is pinned', () => {
    useSimStore.getState().setFieldPanelPinned(true);
    expect(useSimStore.getState().fieldPanelPinned).toBe(true);
  });

  it('keeps the layout across a stage advance', () => {
    useSimStore.getState().setColumnFields(['user', 'verb']);
    useSimStore.getState().pinEvent('sig-shell-spawn');
    useSimStore.getState().pinEvent('sig-exec-create');
    useSimStore.getState().continueFromResolution();
    expect(useSimStore.getState().stageIndex).toBe(1);
    expect(useSimStore.getState().columnFields).toEqual(['user', 'verb']);
  });
});

describe('column layout persistence', () => {
  const base = {
    campaignId: 'sentinel',
    stageIndex: 0,
    revealedFacts: [],
    collectedFacts: [],
    terminalHistory: [],
    clusterStatus: 'suspicious',
    highlightedNodeIds: [],
    revealedEdgeIds: [],
    pinnedEvidence: [],
    activeQuery: '',
    timeRangeId: 'last-1h',
    decisions: {},
    guidanceLevelByStage: {},
    failedAttemptsByStage: {},
    seenBriefingIds: [],
    seenPrimerIds: [],
    pendingStageResolution: null,
  };

  it('treats a save written before columns existed as intact', () => {
    const result = normalizePersistedProgress(base);
    expect(result.issue).toBe('none');
    expect(result.progress.columnFields).toEqual(['source', 'message']);
    expect(result.progress.columnSort).toEqual({ field: 'time', direction: 'desc' });
    expect(result.progress.fieldPanelPinned).toBe(false);
  });

  it('keeps a valid saved layout', () => {
    const result = normalizePersistedProgress({
      ...base,
      columnFields: ['user', 'verb'],
      columnSort: { field: 'user', direction: 'asc' },
      fieldPanelPinned: true,
    });
    expect(result.issue).toBe('none');
    expect(result.progress.columnFields).toEqual(['user', 'verb']);
    expect(result.progress.columnSort).toEqual({ field: 'user', direction: 'asc' });
    expect(result.progress.fieldPanelPinned).toBe(true);
  });

  it('drops field names the corpus cannot produce', () => {
    const result = normalizePersistedProgress({
      ...base,
      columnFields: ['user', 'not-a-field', 'verb'],
    });
    expect(result.issue).toBe('recovered');
    expect(result.progress.columnFields).toEqual(['user', 'verb']);
  });

  it('falls back to the time sort when the sort field is unknown', () => {
    const result = normalizePersistedProgress({
      ...base,
      columnSort: { field: 'not-a-field', direction: 'asc' },
    });
    expect(result.issue).toBe('recovered');
    expect(result.progress.columnSort).toEqual({ field: 'time', direction: 'asc' });
  });

  it('repairs an illegal sort direction', () => {
    const result = normalizePersistedProgress({
      ...base,
      columnSort: { field: 'time', direction: 'sideways' },
    });
    expect(result.issue).toBe('recovered');
    expect(result.progress.columnSort).toEqual({ field: 'time', direction: 'desc' });
  });

  it('repairs a non-boolean pin flag', () => {
    const result = normalizePersistedProgress({ ...base, fieldPanelPinned: 'yes' });
    expect(result.issue).toBe('recovered');
    expect(result.progress.fieldPanelPinned).toBe(false);
  });

  it('accepts the pinned time column as a sort field', () => {
    const result = normalizePersistedProgress({
      ...base,
      columnSort: { field: 'time', direction: 'asc' },
    });
    expect(result.issue).toBe('none');
    expect(result.progress.columnSort).toEqual({ field: 'time', direction: 'asc' });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/engine/store.test.ts -t "column layout"`
Expected: FAIL — `setColumnFields is not a function`.

- [ ] **Step 3: Extend the persisted shape**

In `src/engine/persistence.ts`, add the import and extend `PersistedProgress` and `initialPersistedProgress`:

```ts
// With the existing imports:
import { DEFAULT_COLUMN_FIELDS, DEFAULT_COLUMN_SORT, TIME_FIELD } from './logFields';
import type {
  CampaignId,
  ColumnSort,
  GuidanceLevel,
  PendingStageResolution,
  TerminalEntry,
} from '@/content/types';
```

```ts
// In interface PersistedProgress, after timeRangeId:
  /** Selectable result columns in table order. Never contains `time`. */
  columnFields: string[];
  columnSort: ColumnSort;
  /** Whether the field browser stays open as a split rather than an overlay. */
  fieldPanelPinned: boolean;
```

```ts
// In initialPersistedProgress, after timeRangeId:
  columnFields: [...DEFAULT_COLUMN_FIELDS],
  columnSort: { ...DEFAULT_COLUMN_SORT },
  fieldPanelPinned: false,
```

- [ ] **Step 4: Mark the keys optional and teach the canonical-empty check**

Still in `src/engine/persistence.ts`, extend `OPTIONAL_PROGRESS_KEYS`:

```ts
/**
 * Keys added after v2 shipped. A save written before they existed is still a
 * genuine, readable save — treating its absence as corruption would discard
 * real progress and show the player a recovery warning for nothing.
 */
const OPTIONAL_PROGRESS_KEYS = new Set([
  'seenPrimerIds',
  'columnFields',
  'columnSort',
  'fieldPanelPinned',
]);
```

Then, in `isCanonicalEmptyProgress`, add the layout defaults to the returned boolean expression — insert these three clauses immediately after the `source.timeRangeId === 'last-1h' &&` line:

```ts
    (source.columnFields === undefined ||
      (Array.isArray(source.columnFields) &&
        source.columnFields.join(',') === DEFAULT_COLUMN_FIELDS.join(','))) &&
    (source.columnSort === undefined ||
      (asRecord(source.columnSort).field === DEFAULT_COLUMN_SORT.field &&
        asRecord(source.columnSort).direction === DEFAULT_COLUMN_SORT.direction)) &&
    (source.fieldPanelPinned === undefined || source.fieldPanelPinned === false) &&
```

- [ ] **Step 5: Normalise the three keys**

Still in `src/engine/persistence.ts`, inside `normalizePersistedProgress`, add this block immediately before the `return {` statement:

```ts
  // Column layout. `source` and `message` are promoted fields every event
  // carries, so they belong in the valid set alongside the corpus's own keys.
  const corpusFields = new Set<string>([
    'source',
    'message',
    ...(campaign.logCorpus ?? []).flatMap((event) => Object.keys(event.fields)),
  ]);

  const rawColumnFields = source.columnFields;
  const columnFields = Array.isArray(rawColumnFields)
    ? [
        ...new Set(
          rawColumnFields.filter(
            (field): field is string => typeof field === 'string' && corpusFields.has(field)
          )
        ),
      ].slice(0, 12)
    : [...DEFAULT_COLUMN_FIELDS];
  if (
    rawColumnFields !== undefined &&
    (!Array.isArray(rawColumnFields) || columnFields.length !== rawColumnFields.length)
  ) {
    recovered = true;
  }

  const rawSort = asRecord(source.columnSort);
  const sortField =
    typeof rawSort.field === 'string' &&
    (rawSort.field === TIME_FIELD || corpusFields.has(rawSort.field))
      ? rawSort.field
      : DEFAULT_COLUMN_SORT.field;
  const sortDirection = rawSort.direction === 'asc' || rawSort.direction === 'desc'
    ? rawSort.direction
    : DEFAULT_COLUMN_SORT.direction;
  const columnSort: ColumnSort = { field: sortField, direction: sortDirection };
  if (
    source.columnSort !== undefined &&
    (sortField !== rawSort.field || sortDirection !== rawSort.direction)
  ) {
    recovered = true;
  }

  const fieldPanelPinned = source.fieldPanelPinned === true;
  if (
    source.fieldPanelPinned !== undefined &&
    typeof source.fieldPanelPinned !== 'boolean'
  ) {
    recovered = true;
  }
```

And add the three keys to the returned `progress` object, after `timeRangeId`:

```ts
      columnFields,
      columnSort,
      fieldPanelPinned,
```

- [ ] **Step 6: Add the state, actions, and persist wiring**

In `src/engine/store.ts`:

Extend the type import to include `ColumnSort`, and import the defaults:

```ts
import { DEFAULT_COLUMN_FIELDS, DEFAULT_COLUMN_SORT } from './logFields';
import type {
  Campaign,
  CampaignId,
  ClusterDelta,
  ColumnSort,
  GuidanceLevel,
  PendingStageResolution,
  TerminalEntry,
} from '@/content/types';
```

Add to both the local `PersistedProgress` interface and `SimState`, after `timeRangeId: string;`:

```ts
  columnFields: string[];
  columnSort: ColumnSort;
  fieldPanelPinned: boolean;
```

Add to `SimState`'s action list, after `setTimeRange`:

```ts
  setColumnFields: (fields: string[]) => void;
  setColumnSort: (sort: ColumnSort) => void;
  setFieldPanelPinned: (pinned: boolean) => void;
```

Add the implementations after `setTimeRange` (around line 264):

```ts
        setColumnFields: (fields) => set({ columnFields: fields }),

        setColumnSort: (sort) => set({ columnSort: sort }),

        setFieldPanelPinned: (pinned) => set({ fieldPanelPinned: pinned }),
```

Add to `partialize`, after `timeRangeId`:

```ts
        columnFields: state.columnFields,
        columnSort: state.columnSort,
        fieldPanelPinned: state.fieldPanelPinned,
```

Bump the version:

```ts
      version: 3,
```

And extend the `defaults` object inside `migrate` — both its `Pick<>` type and its value — so a v2 save gains the keys:

```ts
        const defaults: Pick<
          PersistedProgress,
          | 'decisions'
          | 'guidanceLevelByStage'
          | 'failedAttemptsByStage'
          | 'seenBriefingIds'
          | 'seenPrimerIds'
          | 'pendingStageResolution'
          | 'columnFields'
          | 'columnSort'
          | 'fieldPanelPinned'
        > = {
          decisions: {},
          guidanceLevelByStage: {},
          failedAttemptsByStage: {},
          seenBriefingIds: [],
          seenPrimerIds: [],
          pendingStageResolution: null,
          columnFields: [...DEFAULT_COLUMN_FIELDS],
          columnSort: { ...DEFAULT_COLUMN_SORT },
          fieldPanelPinned: false,
        };
```

- [ ] **Step 7: Run the new tests**

Run: `npx vitest run src/engine/store.test.ts -t "column layout"`
Expected: PASS — 16 tests.

- [ ] **Step 8: Run the whole store and persistence suite**

Run: `npx vitest run src/engine`
Expected: PASS. If a pre-existing canonical-empty test fails, the clauses in Step 4 are wrong — the check must treat an absent key as canonical.

- [ ] **Step 9: Commit**

```bash
git add src/engine/persistence.ts src/engine/store.ts src/engine/store.test.ts
git commit -m "feat: persist the analyst's column layout

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 5: Column header menu

**Files:**
- Create: `src/components/LogExplorer/ColumnHeaderMenu.tsx`
- Test: `src/components/LogExplorer/ColumnHeaderMenu.test.tsx`

**Interfaces:**
- Produces: `ColumnHeaderMenu` with props
  `{ field: string; index: number; total: number; onMove: (field: string, direction: -1 | 1) => void; onRemove: (field: string) => void }`.

- [ ] **Step 1: Write the failing test**

Create `src/components/LogExplorer/ColumnHeaderMenu.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ColumnHeaderMenu } from './ColumnHeaderMenu';

function renderMenu(overrides: Partial<React.ComponentProps<typeof ColumnHeaderMenu>> = {}) {
  const props = {
    field: 'user',
    index: 1,
    total: 3,
    onMove: vi.fn(),
    onRemove: vi.fn(),
    ...overrides,
  };
  render(<ColumnHeaderMenu {...props} />);
  return props;
}

describe('ColumnHeaderMenu', () => {
  it('keeps the menu closed until asked', () => {
    renderMenu();
    expect(screen.queryByRole('menu')).toBeNull();
    expect(screen.getByRole('button', { name: /column options for user/i })).toHaveAttribute(
      'aria-expanded',
      'false'
    );
  });

  it('opens the menu', () => {
    renderMenu();
    fireEvent.click(screen.getByRole('button', { name: /column options for user/i }));
    expect(screen.getByRole('menu')).toBeInTheDocument();
  });

  it('moves the column left', () => {
    const props = renderMenu();
    fireEvent.click(screen.getByRole('button', { name: /column options for user/i }));
    fireEvent.click(screen.getByRole('menuitem', { name: /move left/i }));
    expect(props.onMove).toHaveBeenCalledWith('user', -1);
  });

  it('moves the column right', () => {
    const props = renderMenu();
    fireEvent.click(screen.getByRole('button', { name: /column options for user/i }));
    fireEvent.click(screen.getByRole('menuitem', { name: /move right/i }));
    expect(props.onMove).toHaveBeenCalledWith('user', 1);
  });

  it('removes the column', () => {
    const props = renderMenu();
    fireEvent.click(screen.getByRole('button', { name: /column options for user/i }));
    fireEvent.click(screen.getByRole('menuitem', { name: /remove column/i }));
    expect(props.onRemove).toHaveBeenCalledWith('user');
  });

  it('disables moving past either edge', () => {
    renderMenu({ index: 0, total: 1 });
    fireEvent.click(screen.getByRole('button', { name: /column options for user/i }));
    expect(screen.getByRole('menuitem', { name: /move left/i })).toBeDisabled();
    expect(screen.getByRole('menuitem', { name: /move right/i })).toBeDisabled();
  });

  it('closes after an action', () => {
    renderMenu();
    fireEvent.click(screen.getByRole('button', { name: /column options for user/i }));
    fireEvent.click(screen.getByRole('menuitem', { name: /move left/i }));
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('closes on Escape', () => {
    renderMenu();
    fireEvent.click(screen.getByRole('button', { name: /column options for user/i }));
    fireEvent.keyDown(screen.getByRole('menu'), { key: 'Escape' });
    expect(screen.queryByRole('menu')).toBeNull();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/components/LogExplorer/ColumnHeaderMenu.test.tsx`
Expected: FAIL — `Failed to resolve import "./ColumnHeaderMenu"`.

- [ ] **Step 3: Implement**

Create `src/components/LogExplorer/ColumnHeaderMenu.tsx`:

```tsx
'use client';

import { useState } from 'react';
import { cn } from '@/lib/cn';

interface ColumnHeaderMenuProps {
  field: string;
  index: number;
  total: number;
  onMove: (field: string, direction: -1 | 1) => void;
  onRemove: (field: string) => void;
}

const ITEM_CLASS =
  'block w-full px-3 py-1.5 text-left text-xs text-slate-200 hover:bg-mango-500/15 disabled:cursor-not-allowed disabled:text-slate-500 disabled:hover:bg-transparent';

/**
 * Layout adjustments without a trip back to the field panel — the flyout is for
 * choosing what to look at, this is for arranging what you already chose.
 */
export function ColumnHeaderMenu({ field, index, total, onMove, onRemove }: ColumnHeaderMenuProps) {
  const [open, setOpen] = useState(false);

  function act(run: () => void) {
    run();
    setOpen(false);
  }

  return (
    <span className="relative inline-block">
      <button
        type="button"
        aria-label={`Column options for ${field}`}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        className={cn(
          'px-1 text-mango-300/60 hover:text-mango-300',
          open && 'text-mango-300'
        )}
      >
        <span aria-hidden="true">⋮</span>
      </button>

      {open && (
        <span
          role="menu"
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              event.stopPropagation();
              setOpen(false);
            }
          }}
          className="absolute right-0 top-full z-20 mt-1 block w-40 border border-white/15 bg-scene-focal py-1 shadow-panel"
        >
          <button
            type="button"
            role="menuitem"
            disabled={index === 0}
            onClick={() => act(() => onMove(field, -1))}
            className={ITEM_CLASS}
          >
            Move left
          </button>
          <button
            type="button"
            role="menuitem"
            disabled={index >= total - 1}
            onClick={() => act(() => onMove(field, 1))}
            className={ITEM_CLASS}
          >
            Move right
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => act(() => onRemove(field))}
            className={ITEM_CLASS}
          >
            Remove column
          </button>
        </span>
      )}
    </span>
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/components/LogExplorer/ColumnHeaderMenu.test.tsx`
Expected: PASS — 8 tests.

- [ ] **Step 5: Commit**

```bash
git add src/components/LogExplorer/ColumnHeaderMenu.tsx src/components/LogExplorer/ColumnHeaderMenu.test.tsx
git commit -m "feat: add a per-column header menu

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 6: Dynamic, sortable results table

**Files:**
- Modify: `src/components/LogExplorer/ResultsTable.tsx` (full rewrite)
- Modify: `src/components/LogExplorer/ResultsTable.test.tsx`

**Interfaces:**
- Consumes: `fieldValue`, `TIME_FIELD` from Task 1; `ColumnSort` from Task 2; `ColumnHeaderMenu` from Task 5.
- Produces: `ResultsTable` with props
  `{ events: LogEvent[]; columnFields: string[]; sort: ColumnSort; selectedId: string | null; pinnedIds: string[]; onSelect: (eventId: string) => void; onSortChange: (sort: ColumnSort) => void; onColumnFieldsChange: (fields: string[]) => void }`.

**Note:** the row's accessible name stays `Inspect <message>`, so existing `getByRole('button', { name: /Interactive shell spawned/ })` assertions elsewhere keep passing even when the message column is removed.

- [ ] **Step 1: Update the test file**

Replace the whole of `src/components/LogExplorer/ResultsTable.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ResultsTable } from './ResultsTable';
import type { LogEvent } from '@/content/types';

const events: LogEvent[] = [
  {
    id: 'e1',
    timestamp: '2026-08-12T02:14:03Z',
    source: 'edr',
    message: 'Interactive shell spawned',
    fields: { pod: 'ci-deploy-bot-7f9c4d6b6-x2k1p', severity: 'high' },
    arrivesAtStage: 0,
  },
  {
    id: 'e2',
    timestamp: '2026-08-12T02:20:00Z',
    source: 'k8s-audit',
    message: 'get configmaps',
    fields: { user: 'system:kube-scheduler' },
    arrivesAtStage: 0,
  },
];

function renderTable(overrides: Partial<React.ComponentProps<typeof ResultsTable>> = {}) {
  const props = {
    events,
    columnFields: ['source', 'message'],
    sort: { field: 'time', direction: 'desc' } as const,
    selectedId: null as string | null,
    pinnedIds: [] as string[],
    onSelect: vi.fn(),
    onSortChange: vi.fn(),
    onColumnFieldsChange: vi.fn(),
    ...overrides,
  };
  render(<ResultsTable {...props} />);
  return props;
}

describe('ResultsTable', () => {
  it('renders a row per event', () => {
    renderTable();
    expect(screen.getByText('Interactive shell spawned')).toBeInTheDocument();
    expect(screen.getByText('get configmaps')).toBeInTheDocument();
  });

  it('shows each event source', () => {
    renderTable();
    const edr = screen.getByText('edr');
    expect(edr).toHaveClass('text-slate-300');
    expect(edr.className).not.toContain('blight');
  });

  it('selects an event when its row button is activated', () => {
    const props = renderTable();
    fireEvent.click(screen.getByRole('button', { name: /Interactive shell spawned/ }));
    expect(props.onSelect).toHaveBeenCalledWith('e1');
  });

  it('selects an event when the row itself is clicked', () => {
    const props = renderTable();
    fireEvent.click(screen.getByTestId('row-e2'));
    expect(props.onSelect).toHaveBeenCalledWith('e2');
  });

  it('marks the selected row', () => {
    renderTable({ selectedId: 'e1' });
    expect(screen.getByTestId('row-e1')).toHaveAttribute('data-selected', 'true');
  });

  it('marks pinned rows', () => {
    renderTable({ pinnedIds: ['e2'] });
    expect(screen.getByTestId('row-e2')).toHaveAttribute('data-pinned', 'true');
  });

  it('tells the player when nothing matched', () => {
    renderTable({ events: [] });
    expect(screen.getByTestId('empty-results')).toBeInTheDocument();
  });

  it('renders a column per selected field', () => {
    renderTable({ columnFields: ['user', 'severity'] });
    expect(screen.getByRole('columnheader', { name: /user/i })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /severity/i })).toBeInTheDocument();
    expect(screen.queryByText('Interactive shell spawned')).toBeNull();
  });

  it('stays selectable when the message column is removed', () => {
    const props = renderTable({ columnFields: ['user'] });
    fireEvent.click(screen.getByRole('button', { name: /Interactive shell spawned/ }));
    expect(props.onSelect).toHaveBeenCalledWith('e1');
  });

  it('shows a dash where an event does not carry the field', () => {
    renderTable({ columnFields: ['severity'] });
    expect(screen.getByTestId('row-e2')).toHaveTextContent('—');
  });

  it('always keeps the pinned time column', () => {
    renderTable({ columnFields: [] });
    expect(screen.getByRole('columnheader', { name: /time/i })).toBeInTheDocument();
  });

  it('reports the current sort to assistive technology', () => {
    renderTable({ sort: { field: 'time', direction: 'desc' } });
    expect(screen.getByRole('columnheader', { name: /time/i })).toHaveAttribute(
      'aria-sort',
      'descending'
    );
    expect(screen.getByRole('columnheader', { name: /source/i })).toHaveAttribute(
      'aria-sort',
      'none'
    );
  });

  it('sorts a newly chosen column ascending', () => {
    const props = renderTable();
    fireEvent.click(screen.getByRole('button', { name: /sort by source/i }));
    expect(props.onSortChange).toHaveBeenCalledWith({ field: 'source', direction: 'asc' });
  });

  it('flips the direction of the active column', () => {
    const props = renderTable({ sort: { field: 'source', direction: 'asc' } });
    fireEvent.click(screen.getByRole('button', { name: /sort by source/i }));
    expect(props.onSortChange).toHaveBeenCalledWith({ field: 'source', direction: 'desc' });
  });

  it('opens time descending, the way an incident feed reads', () => {
    const props = renderTable({ sort: { field: 'source', direction: 'asc' } });
    fireEvent.click(screen.getByRole('button', { name: /sort by time/i }));
    expect(props.onSortChange).toHaveBeenCalledWith({ field: 'time', direction: 'desc' });
  });

  it('removes a column from its header menu', () => {
    const props = renderTable();
    fireEvent.click(screen.getByRole('button', { name: /column options for source/i }));
    fireEvent.click(screen.getByRole('button', { name: /remove column/i }));
    expect(props.onColumnFieldsChange).toHaveBeenCalledWith(['message']);
  });

  it('moves a column from its header menu', () => {
    const props = renderTable();
    fireEvent.click(screen.getByRole('button', { name: /column options for message/i }));
    fireEvent.click(screen.getByRole('button', { name: /move left/i }));
    expect(props.onColumnFieldsChange).toHaveBeenCalledWith(['message', 'source']);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/components/LogExplorer/ResultsTable.test.tsx`
Expected: FAIL — the new column, sort, and menu tests fail; the table still renders three fixed columns.

- [ ] **Step 3: Rewrite the component**

Replace the whole of `src/components/LogExplorer/ResultsTable.tsx`:

```tsx
'use client';

import type { ColumnSort, LogEvent } from '@/content/types';
import { fieldValue, moveColumnField, removeColumnField, TIME_FIELD } from '@/engine/logFields';
import { cn } from '@/lib/cn';
import { ColumnHeaderMenu } from './ColumnHeaderMenu';

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
                type="button"
                aria-label="Sort by time"
                onClick={() => onSortChange(nextSort(sort, TIME_FIELD))}
                className="hover:text-mango-300"
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
                  className="hover:text-mango-300"
                >
                  {field}
                  {sort.field === field && (
                    <span aria-hidden="true" className="ml-1 text-mango-500">
                      {sort.direction === 'asc' ? '▲' : '▼'}
                    </span>
                  )}
                </button>
                <ColumnHeaderMenu
                  field={field}
                  index={index}
                  total={columnFields.length}
                  onMove={(moved, direction) =>
                    onColumnFieldsChange(moveColumnField(columnFields, moved, direction))
                  }
                  onRemove={(removed) =>
                    onColumnFieldsChange(removeColumnField(columnFields, removed))
                  }
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
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/components/LogExplorer/ResultsTable.test.tsx`
Expected: PASS — 17 tests.

- [ ] **Step 5: Commit**

```bash
git add src/components/LogExplorer/ResultsTable.tsx src/components/LogExplorer/ResultsTable.test.tsx
git commit -m "feat: render dynamic, sortable result columns

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 7: Field value list

**Files:**
- Create: `src/components/LogExplorer/FieldValueList.tsx`
- Test: `src/components/LogExplorer/FieldValueList.test.tsx`

**Interfaces:**
- Consumes: `FieldValueSummary`, `ValueFilterMode` from Tasks 1-2.
- Produces: `FieldValueList` with props
  `{ field: string; values: FieldValueSummary[]; onFilter: (field: string, value: string, mode: ValueFilterMode) => void }`.

- [ ] **Step 1: Write the failing test**

Create `src/components/LogExplorer/FieldValueList.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { FieldValueList } from './FieldValueList';

const values = [
  { value: 'get', count: 180, share: 0.6 },
  { value: 'create', count: 120, share: 0.4 },
];

describe('FieldValueList', () => {
  it('lists each value with its count', () => {
    render(<FieldValueList field="verb" values={values} onFilter={() => {}} />);
    expect(screen.getByText('get')).toBeInTheDocument();
    expect(screen.getByText('180')).toBeInTheDocument();
  });

  it('filters to a value', () => {
    const onFilter = vi.fn();
    render(<FieldValueList field="verb" values={values} onFilter={onFilter} />);
    fireEvent.click(screen.getByRole('button', { name: 'Filter to verb=get' }));
    expect(onFilter).toHaveBeenCalledWith('verb', 'get', 'include');
  });

  it('excludes a value', () => {
    const onFilter = vi.fn();
    render(<FieldValueList field="verb" values={values} onFilter={onFilter} />);
    fireEvent.click(screen.getByRole('button', { name: 'Exclude verb=get' }));
    expect(onFilter).toHaveBeenCalledWith('verb', 'get', 'exclude');
  });

  it('says so when the field has no values in these results', () => {
    render(<FieldValueList field="verb" values={[]} onFilter={() => {}} />);
    expect(screen.getByTestId('no-values')).toBeInTheDocument();
  });

  it('renders a share bar sized to the value', () => {
    render(<FieldValueList field="verb" values={values} onFilter={() => {}} />);
    expect(screen.getByTestId('share-verb-get')).toHaveStyle({ width: '60%' });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/components/LogExplorer/FieldValueList.test.tsx`
Expected: FAIL — `Failed to resolve import "./FieldValueList"`.

- [ ] **Step 3: Implement**

Create `src/components/LogExplorer/FieldValueList.tsx`:

```tsx
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
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/components/LogExplorer/FieldValueList.test.tsx`
Expected: PASS — 5 tests.

- [ ] **Step 5: Commit**

```bash
git add src/components/LogExplorer/FieldValueList.tsx src/components/LogExplorer/FieldValueList.test.tsx
git commit -m "feat: add a field value list with click-to-filter

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 8: The field panel flyout

**Files:**
- Create: `src/components/LogExplorer/FieldPanel.tsx`
- Test: `src/components/LogExplorer/FieldPanel.test.tsx`

**Interfaces:**
- Consumes: `FieldCatalogGroup`, `summarizeFieldValues`, `ValueFilterMode` from Tasks 1-2; `ColumnPreset` from Task 3; `FieldValueList` from Task 7.
- Produces: `FieldPanel` with props
  `{ open: boolean; pinned: boolean; groups: FieldCatalogGroup[]; resultEvents: LogEvent[]; selectedFields: string[]; presets: ColumnPreset[]; onToggleField: (field: string) => void; onMoveField: (field: string, direction: -1 | 1) => void; onApplyPreset: (preset: ColumnPreset) => void; onFilter: (field: string, value: string, mode: ValueFilterMode) => void; onTogglePinned: () => void; onClose: () => void }`.

- [ ] **Step 1: Write the failing test**

Create `src/components/LogExplorer/FieldPanel.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { FieldPanel } from './FieldPanel';
import type { LogEvent } from '@/content/types';

const resultEvents: LogEvent[] = [
  {
    id: 'a1',
    timestamp: '2026-08-12T02:14:01Z',
    source: 'k8s-audit',
    message: 'create pods/exec',
    fields: { user: 'ci-deploy-bot', verb: 'create' },
    arrivesAtStage: 0,
  },
  {
    id: 'a2',
    timestamp: '2026-08-12T02:15:00Z',
    source: 'k8s-audit',
    message: 'get secrets/genome',
    fields: { user: 'ci-deploy-bot', verb: 'get' },
    arrivesAtStage: 0,
  },
];

const groups = [
  {
    id: 'all' as const,
    label: 'All sources',
    fields: [
      { field: 'source', sources: ['k8s-audit' as const, 'edr' as const], count: 2, coverage: 1 },
    ],
  },
  {
    id: 'k8s-audit' as const,
    label: 'k8s-audit',
    fields: [
      { field: 'user', sources: ['k8s-audit' as const], count: 2, coverage: 1 },
      { field: 'verb', sources: ['k8s-audit' as const], count: 2, coverage: 1 },
      { field: 'sourceIP', sources: ['k8s-audit' as const], count: 0, coverage: 0 },
    ],
  },
  {
    id: 'edr' as const,
    label: 'edr',
    fields: [{ field: 'severity', sources: ['edr' as const], count: 0, coverage: 0 }],
  },
];

function renderPanel(overrides: Partial<React.ComponentProps<typeof FieldPanel>> = {}) {
  const props = {
    open: true,
    pinned: false,
    groups,
    resultEvents,
    selectedFields: ['source', 'message'],
    presets: [{ id: 'audit-triage', label: 'Audit triage', fields: ['user', 'verb'] }],
    onToggleField: vi.fn(),
    onMoveField: vi.fn(),
    onApplyPreset: vi.fn(),
    onFilter: vi.fn(),
    onTogglePinned: vi.fn(),
    onClose: vi.fn(),
    ...overrides,
  };
  render(<FieldPanel {...props} />);
  return props;
}

describe('FieldPanel', () => {
  it('renders nothing when closed', () => {
    renderPanel({ open: false });
    expect(screen.queryByTestId('field-panel')).toBeNull();
  });

  it('groups fields under the source that emits them', () => {
    renderPanel();
    expect(screen.getByRole('heading', { name: 'k8s-audit' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'edr' })).toBeInTheDocument();
  });

  it('leads with the shared-field group', () => {
    renderPanel();
    expect(screen.getByRole('heading', { name: 'All sources' })).toBeInTheDocument();
  });

  it('shows how many current results carry each field', () => {
    renderPanel();
    expect(screen.getByTestId('field-user')).toHaveTextContent('2');
    expect(screen.getByTestId('field-user')).toHaveTextContent('100%');
  });

  it('disables a field no current result carries', () => {
    renderPanel();
    expect(screen.getByRole('button', { name: /toggle column sourceIP/i })).toBeDisabled();
  });

  it('toggles a field into the table', () => {
    const props = renderPanel();
    fireEvent.click(screen.getByRole('button', { name: /toggle column user/i }));
    expect(props.onToggleField).toHaveBeenCalledWith('user');
  });

  it('marks fields already in the table', () => {
    renderPanel({ selectedFields: ['user'] });
    expect(screen.getByRole('button', { name: /toggle column user/i })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
  });

  it('lists the selected fields in table order', () => {
    renderPanel({ selectedFields: ['user', 'verb'] });
    const selected = screen.getByTestId('selected-fields');
    expect(selected).toHaveTextContent('user');
    expect(selected).toHaveTextContent('verb');
  });

  it('reorders a selected field', () => {
    const props = renderPanel({ selectedFields: ['user', 'verb'] });
    fireEvent.click(screen.getByRole('button', { name: /move verb up/i }));
    expect(props.onMoveField).toHaveBeenCalledWith('verb', -1);
  });

  it('applies a preset', () => {
    const props = renderPanel();
    fireEvent.click(screen.getByRole('button', { name: /audit triage/i }));
    expect(props.onApplyPreset).toHaveBeenCalledWith(props.presets[0]);
  });

  it('narrows the field list as you type', () => {
    renderPanel();
    fireEvent.change(screen.getByLabelText('filter fields'), { target: { value: 'ver' } });
    expect(screen.getByTestId('field-verb')).toBeInTheDocument();
    expect(screen.queryByTestId('field-user')).toBeNull();
  });

  it('expands a field to show its values', () => {
    renderPanel();
    fireEvent.click(screen.getByRole('button', { name: /show values for verb/i }));
    expect(screen.getByRole('button', { name: 'Filter to verb=create' })).toBeInTheDocument();
  });

  it('passes a value filter up', () => {
    const props = renderPanel();
    fireEvent.click(screen.getByRole('button', { name: /show values for verb/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Filter to verb=create' }));
    expect(props.onFilter).toHaveBeenCalledWith('verb', 'create', 'include');
  });

  it('closes on Escape when it is an overlay', () => {
    const props = renderPanel();
    fireEvent.keyDown(screen.getByTestId('field-panel'), { key: 'Escape' });
    expect(props.onClose).toHaveBeenCalled();
  });

  it('stays put on Escape when pinned', () => {
    const props = renderPanel({ pinned: true });
    fireEvent.keyDown(screen.getByTestId('field-panel'), { key: 'Escape' });
    expect(props.onClose).not.toHaveBeenCalled();
  });

  it('toggles the pin', () => {
    const props = renderPanel();
    fireEvent.click(screen.getByRole('button', { name: /pin field browser/i }));
    expect(props.onTogglePinned).toHaveBeenCalled();
  });

  it('takes focus when it opens', () => {
    renderPanel();
    expect(screen.getByTestId('field-panel')).toHaveFocus();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/components/LogExplorer/FieldPanel.test.tsx`
Expected: FAIL — `Failed to resolve import "./FieldPanel"`.

- [ ] **Step 3: Implement**

Create `src/components/LogExplorer/FieldPanel.tsx`:

```tsx
'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { ColumnPreset, LogEvent } from '@/content/types';
import {
  summarizeFieldValues,
  type FieldCatalogGroup,
  type ValueFilterMode,
} from '@/engine/logFields';
import { cn } from '@/lib/cn';
import { FieldValueList } from './FieldValueList';

interface FieldPanelProps {
  open: boolean;
  pinned: boolean;
  groups: FieldCatalogGroup[];
  /** The current result set — what the counts and value lists describe. */
  resultEvents: LogEvent[];
  selectedFields: string[];
  presets: ColumnPreset[];
  onToggleField: (field: string) => void;
  onMoveField: (field: string, direction: -1 | 1) => void;
  onApplyPreset: (preset: ColumnPreset) => void;
  onFilter: (field: string, value: string, mode: ValueFilterMode) => void;
  onTogglePinned: () => void;
  onClose: () => void;
}

const SECTION_HEADING_CLASS =
  'px-3 pt-3 font-mono text-[10px] uppercase tracking-[0.18em] text-slate-400';

export function FieldPanel({
  open,
  pinned,
  groups,
  resultEvents,
  selectedFields,
  presets,
  onToggleField,
  onMoveField,
  onApplyPreset,
  onFilter,
  onTogglePinned,
  onClose,
}: FieldPanelProps) {
  const [filterText, setFilterText] = useState('');
  const [expandedField, setExpandedField] = useState<string | null>(null);
  const panelRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (open) panelRef.current?.focus();
  }, [open]);

  const expandedValues = useMemo(
    () => (expandedField ? summarizeFieldValues(expandedField, resultEvents) : []),
    [expandedField, resultEvents]
  );

  if (!open) return null;

  const needle = filterText.trim().toLowerCase();

  return (
    <section
      ref={panelRef}
      tabIndex={-1}
      data-testid="field-panel"
      aria-label="Field browser"
      onKeyDown={(event) => {
        if (event.key === 'Escape' && !pinned) onClose();
      }}
      className={cn(
        'flex w-[17rem] shrink-0 flex-col overflow-y-auto border border-white/10 bg-scene-focal outline-none',
        !pinned && 'absolute inset-y-0 left-0 z-10 shadow-panel'
      )}
    >
      <div className="flex items-center justify-between border-b border-white/10 px-3 py-2">
        <h2 className="font-display text-sm font-bold uppercase tracking-[0.14em] text-slate-100">
          Fields
        </h2>
        <div className="flex gap-1">
          <button
            type="button"
            aria-label={pinned ? 'Unpin field browser' : 'Pin field browser'}
            aria-pressed={pinned}
            onClick={onTogglePinned}
            className={cn('px-1 text-xs', pinned ? 'text-mango-300' : 'text-mango-300/50 hover:text-mango-300')}
          >
            <span aria-hidden="true">📌</span>
          </button>
          <button
            type="button"
            aria-label="Close field browser"
            onClick={onClose}
            className="px-1 text-xs text-mango-300/50 hover:text-mango-300"
          >
            <span aria-hidden="true">✕</span>
          </button>
        </div>
      </div>

      <div className="px-3 py-2">
        <input
          aria-label="filter fields"
          value={filterText}
          onChange={(event) => setFilterText(event.target.value)}
          placeholder="Filter fields"
          autoComplete="off"
          spellCheck={false}
          className="w-full border border-mango-500/25 bg-black/40 px-2 py-1 font-mono text-xs text-mango-100 outline-none placeholder:text-mango-300/30"
        />
      </div>

      <h3 className={SECTION_HEADING_CLASS}>Selected fields</h3>
      <ul data-testid="selected-fields" className="px-3 py-1">
        {selectedFields.length === 0 && (
          <li className="py-1 text-[11px] text-slate-500">Time only.</li>
        )}
        {selectedFields.map((field, index) => (
          <li key={field} className="flex items-center gap-1 py-0.5">
            <span className="min-w-0 flex-1 truncate font-mono text-xs text-mango-100">{field}</span>
            <button
              type="button"
              aria-label={`Move ${field} up`}
              disabled={index === 0}
              onClick={() => onMoveField(field, -1)}
              className="px-1 text-xs text-mango-300/60 hover:text-mango-300 disabled:text-slate-600"
            >
              <span aria-hidden="true">▲</span>
            </button>
            <button
              type="button"
              aria-label={`Move ${field} down`}
              disabled={index === selectedFields.length - 1}
              onClick={() => onMoveField(field, 1)}
              className="px-1 text-xs text-mango-300/60 hover:text-mango-300 disabled:text-slate-600"
            >
              <span aria-hidden="true">▼</span>
            </button>
            <button
              type="button"
              aria-label={`Remove ${field} column`}
              onClick={() => onToggleField(field)}
              className="px-1 text-xs text-mango-300/60 hover:text-mango-300"
            >
              <span aria-hidden="true">✕</span>
            </button>
          </li>
        ))}
      </ul>

      {presets.length > 0 && (
        <>
          <h3 className={SECTION_HEADING_CLASS}>Presets</h3>
          <div className="flex flex-wrap gap-1 px-3 py-1">
            {presets.map((preset) => (
              <button
                key={preset.id}
                type="button"
                onClick={() => onApplyPreset(preset)}
                className="border border-mango-500/25 bg-mango-900/40 px-2 py-1 text-[11px] text-mango-300 hover:border-mango-500/60"
              >
                {preset.label}
              </button>
            ))}
          </div>
        </>
      )}

      <h3 className={SECTION_HEADING_CLASS}>Available fields</h3>
      {groups.map((group) => {
        const visible = group.fields.filter((entry) => entry.field.toLowerCase().includes(needle));
        if (visible.length === 0) return null;

        return (
          <div key={group.id} className="px-3 py-1">
            <h4 className="py-1 font-mono text-[11px] text-slate-400">{group.label}</h4>
            <ul>
              {visible.map((entry) => (
                <li key={entry.field} data-testid={`field-${entry.field}`} className="py-0.5">
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      aria-label={`Toggle column ${entry.field}`}
                      aria-pressed={selectedFields.includes(entry.field)}
                      disabled={entry.count === 0}
                      onClick={() => onToggleField(entry.field)}
                      className={cn(
                        'min-w-0 flex-1 truncate text-left font-mono text-xs',
                        entry.count === 0
                          ? 'cursor-not-allowed text-slate-600'
                          : selectedFields.includes(entry.field)
                            ? 'text-mango-300'
                            : 'text-slate-200 hover:text-mango-300'
                      )}
                    >
                      {entry.field}
                    </button>
                    <span className="font-mono text-[10px] text-slate-500">
                      {entry.count} · {Math.round(entry.coverage * 100)}%
                    </span>
                    <button
                      type="button"
                      aria-label={`Show values for ${entry.field}`}
                      aria-expanded={expandedField === entry.field}
                      onClick={() =>
                        setExpandedField((current) => (current === entry.field ? null : entry.field))
                      }
                      className="px-1 text-[10px] text-mango-300/60 hover:text-mango-300"
                    >
                      <span aria-hidden="true">{expandedField === entry.field ? '▾' : '▸'}</span>
                    </button>
                  </div>
                  {expandedField === entry.field && (
                    <FieldValueList
                      field={entry.field}
                      values={expandedValues}
                      onFilter={onFilter}
                    />
                  )}
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </section>
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/components/LogExplorer/FieldPanel.test.tsx`
Expected: PASS — 18 tests.

- [ ] **Step 5: Commit**

```bash
git add src/components/LogExplorer/FieldPanel.tsx src/components/LogExplorer/FieldPanel.test.tsx
git commit -m "feat: add the field browser flyout

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 9: Wire the panel into the log explorer

**Files:**
- Modify: `src/components/LogExplorer/LogExplorer.tsx`
- Modify: `src/components/LogExplorer/LogExplorer.test.tsx`

**Interfaces:**
- Consumes: everything from Tasks 1-8.
- Produces: `LogExplorer` gains props
  `columnFields: string[]`, `columnSort: ColumnSort`, `fieldPanelPinned: boolean`, `presets: ColumnPreset[]`, `onColumnFieldsChange: (fields: string[]) => void`, `onColumnSortChange: (sort: ColumnSort) => void`, `onFieldPanelPinnedChange: (pinned: boolean) => void`.

**The load-bearing rule:** a value click never calls `onFailedAttempt`. Typed submissions still do. Clicking through a value list is exploration, not a wrong hypothesis; feeding it to the guidance counter would trigger a hint after two idle clicks.

- [ ] **Step 1: Update the test file**

In `src/components/LogExplorer/LogExplorer.test.tsx`, extend the `renderExplorer` props object with the new props:

```tsx
  const props = {
    events,
    ranges,
    timeRangeId: 'last-1h',
    query: '',
    columnFields: ['source', 'message'],
    columnSort: { field: 'time', direction: 'desc' as const },
    fieldPanelPinned: false,
    presets: [{ id: 'audit-triage', label: 'Audit triage', fields: ['severity'] }],
    suggestions: [{ label: 'High severity', query: 'severity=high' }],
    hint: 'Try narrowing by severity.',
    pinnedIds: [] as string[],
    selectedId: null as string | null,
    onQueryChange: vi.fn(),
    onTimeRangeChange: vi.fn(),
    onColumnFieldsChange: vi.fn(),
    onColumnSortChange: vi.fn(),
    onFieldPanelPinnedChange: vi.fn(),
    onPin: vi.fn(),
    onUnpin: vi.fn(),
    onSelect: vi.fn(),
    onFailedAttempt: vi.fn(),
    ...overrides,
  };
```

Then append these tests inside the existing `describe('LogExplorer', ...)` block:

```tsx
  it('opens the field browser from the edge tab', () => {
    renderExplorer();
    expect(screen.queryByTestId('field-panel')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /open field browser/i }));
    expect(screen.getByTestId('field-panel')).toBeInTheDocument();
  });

  it('keeps the field browser open when it is pinned', () => {
    renderExplorer({ fieldPanelPinned: true });
    expect(screen.getByTestId('field-panel')).toBeInTheDocument();
  });

  it('rewrites and runs the query when a value is filtered', () => {
    const props = renderExplorer({ query: 'source=edr' });
    fireEvent.click(screen.getByRole('button', { name: /open field browser/i }));
    fireEvent.click(screen.getByRole('button', { name: /show values for severity/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Filter to severity=high' }));
    expect(props.onQueryChange).toHaveBeenCalledWith('source=edr severity=high');
  });

  it('does not count a value click as a failed attempt', () => {
    const props = renderExplorer({ query: 'severity=low' });
    fireEvent.click(screen.getByRole('button', { name: /open field browser/i }));
    fireEvent.click(screen.getByRole('button', { name: /show values for severity/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Exclude severity=low' }));
    expect(props.onFailedAttempt).not.toHaveBeenCalled();
  });

  it('applies a preset to the columns', () => {
    const props = renderExplorer();
    fireEvent.click(screen.getByRole('button', { name: /open field browser/i }));
    fireEvent.click(screen.getByRole('button', { name: /audit triage/i }));
    expect(props.onColumnFieldsChange).toHaveBeenCalledWith(['severity']);
  });

  it('sorts the rendered rows by the chosen column', () => {
    renderExplorer({ columnSort: { field: 'time', direction: 'asc' } });
    const rows = screen.getAllByRole('row').slice(1);
    expect(rows[0]).toHaveAttribute('data-testid', 'row-e1');
  });
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/components/LogExplorer/LogExplorer.test.tsx`
Expected: FAIL — no "Open field browser" button exists.

- [ ] **Step 3: Rewrite the component**

Replace the whole of `src/components/LogExplorer/LogExplorer.tsx`:

```tsx
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
    setPanelOpen(false);
    if (fieldPanelPinned) onFieldPanelPinnedChange(false);
    panelToggleRef.current?.focus();
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
            if (!fieldPanelPinned) setPanelOpen(false);
          }}
          onFilter={filterByValue}
          onTogglePinned={() => {
            onFieldPanelPinnedChange(!fieldPanelPinned);
            if (!fieldPanelPinned) setPanelOpen(false);
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
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/components/LogExplorer/LogExplorer.test.tsx`
Expected: PASS — 15 tests.

- [ ] **Step 5: Commit**

```bash
git add src/components/LogExplorer/LogExplorer.tsx src/components/LogExplorer/LogExplorer.test.tsx
git commit -m "feat: wire the field browser into the log explorer

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 10: Connect the mission workspace to the store

**Files:**
- Modify: `src/app/mission/page.tsx:88,246-260`
- Test: `src/app/mission/page.test.tsx`

**Interfaces:**
- Consumes: store keys and actions from Task 4; `LogExplorer` props from Task 9.

- [ ] **Step 1: Write the failing test**

Append this `describe` block to `src/app/mission/page.test.tsx`. It uses the file's existing `renderWorkspace` helper (defined at line 20) — do not add a second one:

```tsx
describe('MissionPage field browser', () => {
  it('offers the field browser on the Sentinel log explorer', () => {
    renderWorkspace('sentinel');
    expect(screen.getByRole('button', { name: /open field browser/i })).toBeInTheDocument();
  });

  it('keeps a chosen column layout in the store', () => {
    renderWorkspace('sentinel');
    fireEvent.click(screen.getByRole('button', { name: /open field browser/i }));
    fireEvent.click(screen.getByRole('button', { name: /audit triage/i }));
    expect(useSimStore.getState().columnFields).toEqual([
      'user',
      'verb',
      'resource',
      'namespace',
      'responseCode',
    ]);
  });

  it('tables the chosen fields in the results', () => {
    renderWorkspace('sentinel');
    fireEvent.click(screen.getByRole('button', { name: /open field browser/i }));
    fireEvent.click(screen.getByRole('button', { name: /audit triage/i }));
    expect(screen.getByRole('columnheader', { name: /responseCode/i })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/app/mission/page.test.tsx -t "field browser"`
Expected: FAIL — no such button.

- [ ] **Step 3: Add the store selectors**

In `src/app/mission/page.tsx`, add after the `timeRangeId` selector (line 88):

```tsx
  const columnFields = useSimStore((state) => state.columnFields);
  const columnSort = useSimStore((state) => state.columnSort);
  const fieldPanelPinned = useSimStore((state) => state.fieldPanelPinned);
```

And after the `setTimeRange` selector:

```tsx
  const setColumnFields = useSimStore((state) => state.setColumnFields);
  const setColumnSort = useSimStore((state) => state.setColumnSort);
  const setFieldPanelPinned = useSimStore((state) => state.setFieldPanelPinned);
```

- [ ] **Step 4: Pass them to the explorer**

In the same file, extend the `<LogExplorer>` element:

```tsx
              <LogExplorer
                key={stage.id}
                events={arrivedEvents}
                ranges={campaign.timeRanges ?? []}
                timeRangeId={timeRangeId}
                query={activeQuery}
                columnFields={columnFields}
                columnSort={columnSort}
                fieldPanelPinned={fieldPanelPinned}
                presets={campaign.columnPresets ?? []}
                pinnedIds={pinnedEvidence}
                selectedId={selectedEventId}
                insertion={queryInsertion}
                onQueryChange={setQuery}
                onTimeRangeChange={setTimeRange}
                onColumnFieldsChange={setColumnFields}
                onColumnSortChange={setColumnSort}
                onFieldPanelPinnedChange={setFieldPanelPinned}
                onSelect={setSelectedEventId}
                onFailedAttempt={() => recordAttempt(false)}
              />
```

- [ ] **Step 5: Run the new tests**

Run: `npx vitest run src/app/mission/page.test.tsx`
Expected: PASS. If an existing test counts buttons or asserts on tab order, the new edge tab may have shifted it — fix the assertion, not the feature.

- [ ] **Step 6: Run the whole suite**

Run: `npm run test`
Expected: PASS. This is the first point the whole feature is connected; fix any fallout here.

- [ ] **Step 7: Verify the production build**

Run: `npm run build`
Expected: Build succeeds with no TypeScript errors.

- [ ] **Step 8: Commit**

```bash
git add src/app/mission/page.tsx src/app/mission/page.test.tsx
git commit -m "feat: connect the field browser to persisted mission state

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 11: Teach the panel in the primer

**Files:**
- Modify: `src/content/chapter1/primer.ts`

**Interfaces:**
- Consumes: `PrimerSection` from `src/content/types.ts` (already defined).

- [ ] **Step 1: Add the section**

In `src/content/chapter1/primer.ts`, inside `sentinelPrimer.sections`, insert this object between the `query-syntax` section and the `time-is-a-filter` section:

```ts
    {
      id: 'building-a-table',
      title: 'Building a table',
      body: [
        'The results table opens on three columns because that is a safe default, not because it is the right view. The Fields panel down the left of the results lists every field your sources produce, grouped by the source that writes it, and turns any of them into a column.',
        'Each field carries a count: how many events in your current results actually have it. A field sitting at zero is not empty — that source never recorded it. Knowing which source can answer a question is faster than asking every source in turn.',
        'Tabling the right two or three fields is the whole trick. An outlier stops being a sentence you have to read and becomes a value that looks wrong in a column you are already scanning.',
      ],
      entries: [
        {
          term: 'Fields panel',
          meaning: 'Opens from the left edge of the results.',
          note: 'Pin it if you are going to be working in one source for a while.',
        },
        {
          term: 'user · 312 · 74%',
          meaning: 'The field, how many current results carry it, and what share that is.',
          note: 'Low coverage usually means the field belongs to a source your search has mostly filtered out.',
        },
        {
          term: 'Expanding a field',
          meaning: 'Lists its most common values with counts.',
          note: 'The fastest way to notice that one value in a column is not like the others.',
        },
        {
          term: '+ and −',
          meaning: 'Add that value to your search, or exclude it.',
          note: 'The search bar shows the syntax it wrote for you — edit it from there.',
        },
        {
          term: 'Presets',
          meaning: 'Ready-made column sets for audit, EDR, and authorization triage.',
        },
        {
          term: 'Column headers',
          meaning: 'Click to sort; the ⋮ menu moves or removes the column.',
          note: 'Time sorts newest-first, which is where an incident feed wants to be.',
        },
      ],
    },
```

- [ ] **Step 2: Verify the content suite**

Run: `npm run validate:content`
Expected: PASS.

- [ ] **Step 3: Verify the primer renders**

Run: `npx vitest run src/components/Primer`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/content/chapter1/primer.ts
git commit -m "docs: teach the field panel in the Sentinel primer

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 12: End-to-end and accessibility coverage

**Files:**
- Modify: `tests/e2e/accessibility.spec.ts`

**Interfaces:**
- Consumes: the finished UI from Tasks 1-11.

- [ ] **Step 1: Add the panel cases**

Append to `tests/e2e/accessibility.spec.ts`. It already imports `activate` and `seedProgress` from `./helpers` and defines `expectWcag22AA` — reuse all three rather than writing new navigation.

Note that `seedProgress` writes a `version: 2` envelope with no column keys, which is exactly the pre-feature save shape — so this test also proves an existing player's save survives the upgrade without a recovery warning.

```ts
test('field browser passes axe WCAG 2.2 AA, open and pinned', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await seedProgress(page, 'sentinel', 0, { seenBriefingIds: ['triage'] });
  await page.goto('/mission');
  await expect(page.getByRole('main', { name: 'Mission workspace' })).toBeVisible();
  await expect(page.getByText(/could not be read|was repaired/i)).toHaveCount(0);

  await activate(page, 'button', 'Open field browser');
  await expect(page.getByTestId('field-panel')).toBeVisible();
  await expectWcag22AA(page, 'field browser open');

  await activate(page, 'button', 'Pin field browser');
  await expect(page.getByTestId('field-panel')).toBeVisible();
  await expectWcag22AA(page, 'field browser pinned');

  const overflow = await page.evaluate(() => ({
    htmlX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    bodyX: document.body.scrollWidth - document.body.clientWidth,
  }));
  expect(overflow).toEqual({ htmlX: 0, bodyX: 0 });
});
```

- [ ] **Step 2: Run the e2e suite**

Run: `npm run test:e2e`
Expected: PASS.

**If the overflow assertion fails when pinned:** the spec names this outcome and its resolution. Remove the pin control — delete the pin button from `FieldPanel`, drop `fieldPanelPinned` from the `LogExplorer` props, and leave the panel as a pure overlay. Keep the store key and its normalisation; a persisted `false` costs nothing and removing it churns the save format again. Record the cut in the spec's Deviations.

- [ ] **Step 3: Run the full suite one more time**

Run: `npm run test`
Expected: PASS.

- [ ] **Step 4: Manual playthrough**

Run: `npm run dev`, open the Sentinel campaign, and confirm by hand:

1. The **Fields** edge tab opens the panel; Esc closes it; focus returns to the tab.
2. Field counts change as the query narrows; a field with no coverage greys out.
3. Expanding `verb` lists values; **+** writes `verb=create` into the search bar and results update.
4. Clicking **+** on a second value of the same field *replaces* rather than ANDs.
5. Applying **Audit triage** re-tables the results; sorting by `user` works; the ⋮ menu moves and removes columns.
6. Selecting a row still opens the event detail and pinning still advances the stage.
7. Reloading the page restores the column layout.

- [ ] **Step 5: Commit**

```bash
git add tests/e2e/accessibility.spec.ts
git commit -m "test: cover the field browser in the accessibility sweep

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Deviations From The Spec, Recorded Here

- **`FieldCatalogEntry.distinctValues` was cut.** The spec's catalog carried a distinct-value count; nothing in the panel renders it, so it is not built. YAGNI.
- **`buildFieldCatalog` takes two event lists** rather than one. The spec describes the catalog and the live numbers as separate concerns; passing both makes that explicit and lets one call produce a coverage-sorted result, instead of the panel re-sorting what the engine handed it.
