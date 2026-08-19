# Operation Mango: SIEM Field Browser & Dynamic Columns — Design

## Overview

The Sentinel's log explorer ships with a fixed three-column table — Time, Source,
Event — and a search bar. Everything a log event carries beyond those three
fields is reachable only by selecting a row and reading the detail panel, one
event at a time. That is not how anyone hunts in a real SIEM.

This build adds a **left field browser flyout** and **dynamic result columns**:
the analyst picks which fields become columns, reorders and sorts them, and
browses each field's values to refine the query by clicking rather than typing.
It also **widens the noise corpus** so the field browser cannot be used as an
oracle — a prerequisite the previous spec identified and deferred, which this
feature makes load-bearing.

The intended audience's reference points are Splunk and CrowdStrike, so the
interaction model is deliberately theirs: a collapsible left sidebar listing
fields with event coverage, a value summary per field, and click-to-filter.

Builds on `2026-08-12-siem-log-explorer-and-attack-map-design.md`. The
Infiltrator campaign is untouched — it has no log corpus and never opens this
surface.

## Motivation

Investigation is pivoting, and pivoting has two halves. The current explorer has
one: you can narrow a result set by typing a query. It has none of the other:
you cannot *see the shape of your data*. An analyst who does not already know
that `k8s-audit` records `responseCode` has no way to discover it except by
reading the primer or clicking events until one shows it.

A field browser makes the data self-describing. Opening it against a result set
of API audit records and seeing `verb`, `resource`, `namespace`, `responseCode`
with counts beside them teaches the source's schema in one glance — and tabling
three of them turns a wall of prose messages into something you can scan down a
column and spot the outlier in.

That is the actual skill: not writing the perfect query, but shaping the view
until the anomaly is visually obvious.

## Core Model: The Catalog Is Derived, The Numbers Are Live

The panel shows two things that must not be confused:

1. **What exists** — every field the visible corpus can produce, grouped by the
   source that emits it. Derived from the events at the current stage horizon
   (`arrivesAtStage <= stageIndex`), so it is stable while the analyst edits a
   query and never hand-maintained alongside the corpus.
2. **What is here now** — event count, coverage share, and top values, computed
   against the *current result set*. These move with every search.

Splunk's sidebar collapses both into one list, which is why its fields appear
and vanish as you narrow. Keeping them separate is the one deliberate departure:
a field that drops to zero coverage stays visible, greyed and unselectable, so
the analyst learns *this source has no such field* rather than watching an item
silently disappear. That distinction is the pedagogical payload of the whole
panel.

## The Oracle Problem

The previous spec recorded, after implementation, that the corpus's 5%
signal-ratio bound constrains the *volume* of signal but not its
*distinguishability*, and that a future corpus should be tested for field
overlap between signal and noise. That deferred item becomes urgent here.

Measured against the corpus as it stands — 421 events, 11 of them signal:

| Field | Events | All signal? | Exposes |
| --- | --- | --- | --- |
| `sourceIP` | 7 | yes | the entire attack chain |
| `object` | 6 | yes | binding origin, secret read, both rogue creations |
| `role` | 4 | yes | every cluster-admin binding |
| `annotation`, `binding`, `bytesOut`, `container`, `detection`, `reason` | 1 each | yes | one smoking gun each |

Signal-exclusive *values* on otherwise-shared fields compound it: `severity=high`,
`verb=list`, `namespace=*`, and `resource=secrets` each return signal and nothing
else.

Today this is latent, because exploiting it requires guessing the string
`sourceIP` unprompted. A field browser that lists every field with a coverage
count **surfaces these at the top of a rarity sort** — and rare-field hunting is
the first instinct of the Splunk-trained analyst this experience is built for.
Chapter 1 would fall in three clicks, by a route more efficient than the intended
one.

### The fix: widen the noise, then enforce it

Benign noise templates gain real values for every field the signal carries:
internal `sourceIP` values on routine audit records, `object` names on ordinary
gets and creates, `role` on benign binding reads, `container` and `detection` on
routine EDR lines, small `bytesOut` on normal egress, and a spread of `severity`
so `high` is no longer signal-exclusive. Where a signal value is meant to stand
out — the external `203.0.113.44`, `namespace=*` — the noise gains *neighbouring*
values in the same field rather than that exact value.

The effect is that rare-field hunting still works, and should: narrowing to
`sourceIP` is a legitimate technique that legitimately shrinks the haystack. It
just stops being a solve. The analyst still has to look at the values and
recognise that one of these addresses is not like the others.

Two invariants get tests in `corpus.test.ts`:

- **No field is signal-exclusive.** Every field carried by a signal event is also
  carried by at least three benign events.
- **Every field offers a benign comparison.** For each such field, benign events
  supply at least two distinct values, so expanding it in the browser always
  presents a spread to judge against rather than a single obvious answer.

It remains intentional that a *specific value* is attacker-only — the external
`203.0.113.44` should stand alone in a list of internal addresses, and
recognising that is the skill being taught. What must not happen is the *field
itself* acting as the pointer.

The existing 5% ratio test stays. It measures a different property and both
matter.

### Consequences to re-verify

Widening the noise perturbs result sets the guided track depends on. Three
things must be re-checked after the corpus changes, and each has a test:

- The stage guidance `insertText` queries (`source=edr severity=high`,
  `user=ci-deploy-bot`, `source=k8s-audit resource=secrets`,
  `source=k8s-audit verb=create namespace=kube-system`) must still return their
  signal event, and must still return a **scannable** result set — asserted at
  25 events or fewer, so the answer stays findable by eye.
- `sentinel.reachability.test.ts` must still prove every stage completable.
- The 5% signal ratio must hold at every stage and in the default hour.

## Architecture

Client-side only, no new dependencies.

### Engine — `src/engine/logFields.ts` (new)

Pure, React-free, unit-tested:

| Export | Responsibility |
| --- | --- |
| `buildFieldCatalog(events)` | Every field across the events, with the sources that emit it and its distinct-value count. Grouped by source. |
| `summarizeField(field, events)` | Event count, coverage share, and top values with counts and shares. Ties broken alphabetically so output is deterministic. |
| `sortEvents(events, sort)` | Applies the chosen column sort. |
| `applyValueFilter(query, field, value, mode)` | Returns the new query string for an include/exclude click. |

`fieldValue()` is promoted from a module-local helper in `logQuery.ts` to an
export, and both column rendering and field summaries read through it. One
accessor means `source` and `message` can never become queryable-but-not-tableable,
or vice versa.

`sortEvents` compares timestamps as dates and everything else as
case-insensitive strings, with rows missing the field always sorted last
regardless of direction. Default remains `time` descending — identical to what
`executeQuery` produces today, so an untouched table does not change.

`applyValueFilter` implements the token rules below as a pure string transform,
so they are testable without rendering anything.

### Content

`src/content/chapter1/logs/columnPresets.ts` (new), reaching the UI through a
new optional `Campaign.columnPresets` — the same plumbing `timeRanges` already
uses:

- **Audit triage** — user, verb, resource, namespace, responseCode
- **EDR triage** — pod, process, parent, severity
- **API authorization** — user, decision, status
- **Default** — source, message

Presets name only selectable fields. Time is the pinned leading column and is
never listed, so a preset's field list can be assigned straight to
`columnFields` without filtering.

Curated rather than derived per source, because *which fields matter for triage*
is itself worth teaching; a generated "all eight fields this source carries"
preset teaches nothing. A content test asserts every preset field exists in the
corpus, so `npm run validate:content` catches drift.

### Components — `src/components/LogExplorer/`

| Component | Responsibility |
| --- | --- |
| `FieldPanel.tsx` (new) | The flyout: field filter, selected list, available fields grouped by source, expandable value browser. |
| `FieldValueList.tsx` (new) | One field's top values with counts, share bars, and include/exclude controls. |
| `ColumnHeaderMenu.tsx` (new) | Per-column move left / move right / remove. |
| `ResultsTable.tsx` (rewritten) | Renders `columns.fields` dynamically; sortable headers; leading selection gutter. |
| `LogExplorer.tsx` (extended) | Owns the panel's open state, wires column state and value-filter clicks. |

## The Flyout

A thin vertical **Fields** edge tab sits on the left of the log explorer. It
opens to a ~17rem panel over the results; a pin control converts it into a
persistent split that reflows the table. Unpinned, it closes on Esc and after a
preset is chosen. Pinned, it stays. Pin state persists across sessions.

Top to bottom: a filter-fields input, then **Selected fields** in table order,
each with move up / move down / remove, then **Available fields** under source
headings — `severity · 41 events · 19%` — greyed and unselectable at zero
coverage in the current result set. Presets sit at the top as a row of chips.

Expanding a field reveals its top values with counts and share bars. Each value
carries explicit **+** and **−** buttons rather than modifier-clicks, because a
modifier-click has no keyboard equivalent and this surface has to survive the
axe pass.

### Token semantics

Clicking **+** or **−** rewrites the query and runs it immediately. One click,
new results — anything slower is not worth building.

- Same field, same value, same polarity → the token is **removed** (a toggle).
- Same field, different value → the existing token is **replaced**.
- New field → the token is **appended**.

Splunk would AND a second value of the same field and return zero rows. Replacing
is the modern-SIEM behaviour and it is the difference between the panel feeling
alive and feeling broken. The rewritten query is visible and editable in the
search bar, so the syntax is still being taught by demonstration — the principle
the existing `QueryChips` comment articulates.

### Value clicks do not count as failed attempts

`recordAttempt(false)` drives guidance auto-escalation: two failures unlock tier
one, four unlock tier two, six unlock tier three. Typed submissions that parse
badly, return nothing, or name an unknown field continue to count. **Value clicks
never do**, even when they narrow to zero rows.

Clicking through a value list is exploration, not a wrong hypothesis. Letting it
feed the counter would mean two idle clicks trigger a hint, which cheapens a
guidance ladder a recent commit deliberately deepened.

## Results Table

`columns.fields` drives the rendered columns. Time is a pinned leading column, as
in Splunk's event view; `source` and `message` are ordinary removable fields that
happen to be selected by default — so an untouched table is exactly what ships
today.

- Missing value renders a dimmed `—`, never a blank cell.
- Long values truncate with the full value in `title`; the table keeps its
  existing `overflow-x-auto`.
- Headers are sort buttons carrying `aria-sort`, each with a `ColumnHeaderMenu`.
- Row selection moves to a narrow leading gutter button whose accessible name is
  `Inspect <message>`. This keeps the row selectable when the message column is
  removed, gives the whole-row click a keyboard equivalent, and keeps existing
  `getByRole('button', { name: /Interactive shell spawned/ })` assertions valid.
- The pinned-evidence dot moves into the gutter alongside it.

## State & Persistence

Three keys join the store and the persisted progress envelope:

```ts
columnFields: string[];                                 // ordered, excludes time
columnSort: { field: string; direction: 'asc' | 'desc' };
fieldPanelPinned: boolean;
```

Actions: `setColumnFields`, `setColumnSort`, `setFieldPanelPinned`.

Layout is global and survives stage transitions — unlike `selectedEventId`, which
resets. An analyst's table is theirs; rebuilding it every stage would be an
irritation, not a lesson.

`normalizePersistedProgress` validates them the way `pinnedEvidence` already is:
unknown field names dropped against the campaign's corpus field set, direction
constrained to the two legal values, count capped at twelve. Unknown or malformed
input reports `'recovered'`, consistent with every other key.

Two details in `persistence.ts` are easy to miss and both would produce a false
"your save was repaired" warning for existing players:

- The three keys must join `OPTIONAL_PROGRESS_KEYS`, so a save written before
  this feature is not read as corrupt for lacking them.
- `isCanonicalEmptyProgress` must learn their empty-state values, or a
  fresh-browser save stops matching the canonical-empty shape.

The persist `version` goes to 3, with a migration filling defaults.

## Content: Primer

One additive section under *Your data sources*, titled **Building a table**: what
the coverage numbers mean, why fields differ by source, that a field absent from
a source was never recorded rather than empty, and that tabling a field is how
you make an outlier visible.

The guidance ladder is untouched. It was deliberately tuned recently and this
feature should not perturb it.

## Testing

- **`logFields.test.ts`** — catalog grouping and distinct-value counts; summary
  ordering, tie-breaking, and coverage maths; `sortEvents` across timestamps,
  strings, both directions, and missing values; `applyValueFilter` for all three
  token cases in both polarities.
- **`FieldPanel.test.tsx`** — fields grouped under source headings; coverage
  rendered; zero-coverage fields greyed and unselectable; toggling a field emits
  the new column list; expanding shows values; include/exclude emit the right
  query; the field filter narrows the list; choosing a preset replaces the column
  set; Esc closes when unpinned and does not when pinned; focus enters the panel
  on open and returns to the toggle on close.
- **`ResultsTable.test.tsx`** — dynamic columns; `—` for missing values;
  `aria-sort` reflects state; header menu moves and removes; existing selection
  and pin assertions still pass.
- **`LogExplorer.test.tsx`** — a value click rewrites and runs the query; a
  zero-result value click does **not** call `onFailedAttempt` while a typed
  zero-result submission still does.
- **`store.test.ts`** — the three new actions, and layout surviving a stage
  advance.
- **Persistence tests** — a pre-feature save reports `'none'`, not `'corrupt'`;
  bogus field names and a bad sort direction report `'recovered'`.
- **`corpus.test.ts`** — the two new field-overlap invariants; the existing ratio
  tests unchanged; guided `insertText` queries still return their signal event
  within a 25-event scannable ceiling.
- **`columnPresets.test.ts`** — every preset field exists in the corpus.
- **`accessibility.spec.ts`** — the existing axe sweep covers the panel open,
  with a case added for the pinned state.

## Scope

**In scope:** the field browser flyout, dynamic and sortable columns, curated
presets, the value-click filter loop, noise-corpus widening with its enforcing
tests, persistence of layout, and the primer section.

**Out of scope:** query aggregation (`| stats count by field`), which the
existing spec already defers and which nothing here needs; table-cell click
filtering, cut deliberately to keep the results table a single-purpose surface;
row density and message-wrap controls; column width dragging; saved custom
presets; any change to the Infiltrator campaign.

## Risks

- **Corpus widening is the real risk in this build.** It changes result sets the
  guided track depends on, and its failure mode is subtle: the guidance still
  technically works while the signal becomes harder to see than intended. The
  25-event scannable ceiling on guided queries is the guard, and a manual
  playthrough of the full Sentinel arc is a required step, not an optional one.
- **Horizontal space.** The workspace is already two columns. Pinning the panel
  open while tabling six fields will be tight at 1280px, the width the e2e suite
  asserts against. The overlay default rather than a permanent rail is the
  mitigation; if the pinned split proves unusable at that width, pinning is what
  gets cut.
