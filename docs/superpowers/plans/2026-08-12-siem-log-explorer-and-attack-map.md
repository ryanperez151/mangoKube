# SIEM Log Explorer & Attack Path Map Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a guided, Splunk-style log exploration interface and a progressively-revealed illustrated attack path map to Operation Mango, and rework the Chapter 1 Sentinel campaign so the defender investigates by searching logs and pinning evidence rather than by typing scripted commands.

**Architecture:** A searchable corpus of structured `LogEvent` records (EDR, Kubernetes audit, API server, CI/CD) is filtered by a small Splunk-style query language. Events carry an optional `revealsFact`; the player reveals facts by **pinning** an event, not by matching a command string. Stages gain `advanceWhen: { facts }`, evaluated after every fact reveal, so the SIEM drives progression while the terminal is retained for Stage 5 response actions. An attack map derives each node's state (undiscovered/suspected/confirmed/contained) purely from collected facts.

**Tech Stack:** Next.js 14 (static export) + React 18 + TypeScript (strict) + Zustand (persist) + Framer Motion + Tailwind CSS + Vitest + @testing-library/react. **No new dependencies.**

## Global Constraints

- Fully simulated in-browser: no real Kubernetes cluster, no backend, no network calls.
- `output: 'export'` static export — no Next.js server-only APIs (route handlers, server actions, `next/headers`).
- TypeScript `strict: true`. No `any`.
- No new npm dependencies. Fonts must be CSS font stacks, **not** `next/font/google` — the build must succeed offline.
- The soft-lock guarantee is absolute: every stage must have an automatically-verified path to advancement, now across **both** commands and pinnable events.
- Signal events must stay under **5%** of events visible at any stage (asserted by test).
- Noise generation must be **deterministic** (seeded) so tests and playthroughs are stable.
- Field matching in queries is **case-insensitive substring** matching — one rule, applied everywhere.
- The Infiltrator campaign's behavior must not change. Its existing tests must keep passing.
- Motion must respect `prefers-reduced-motion`; attack-map node state must be conveyed by shape and label as well as color.

## Execution Order Note

Tasks are written to be executed in order, with one exception worth knowing
about: the component tasks (8–12) use Tailwind colour utilities
(`orchard-*`, `leaf-*`, `blight-*`, `mango-100`, `mango-700`) that the
theme does not define until **Task 13**. Nothing breaks — Tailwind simply
does not emit those classes yet, so tests and the build both pass, but the
UI looks unstyled if you open it before Task 13 lands.

If you want accurate visuals while building the components, pull Task 13
forward and run it first. It touches only `tailwind.config.ts`,
`globals.css`, and `layout.tsx`, and depends on nothing from Tasks 1–12.

## File Structure

**Engine (`src/engine/`)**
- `logQuery.ts` (new) — parse a query string to an AST; execute an AST over events. Pure, no React, no store.
- `reachability.ts` (modify) — BFS over commands **and** pinnable events.
- `store.ts` (modify) — evidence pinning, query/time-range state, unified fact reveal, `advanceWhen` evaluation.

**Content (`src/content/`)**
- `types.ts` (modify) — `LogSource`, `LogEvent`, `TimeRange`, `QueryAst`, `QuerySuggestion`, `AttackMapNode`; extends `Stage` and `Campaign`.
- `chapter1/logs/signal.ts` (new) — hand-authored smoking-gun events.
- `chapter1/logs/noise.ts` (new) — deterministic benign-traffic generator.
- `chapter1/logs/index.ts` (new) — assembled corpus + time-range presets.
- `chapter1/attackMap.ts` (new) — kill-chain nodes + `deriveNodeState`.
- `chapter1/sentinel.ts` (rewrite) — SIEM-driven five-stage arc.

**Components (`src/components/`)**
- `LogExplorer/SearchBar.tsx`, `QueryChips.tsx`, `ResultsTable.tsx`, `EventDetail.tsx`, `Histogram.tsx`, `LogExplorer.tsx`
- `AttackMap/AttackMap.tsx`
- `CaseFile/CaseFile.tsx`

**App (`src/app/`)**
- `mission/page.tsx` (modify) — composition root only.
- `globals.css`, `tailwind.config.ts` (modify) — orchard visual system.

---

### Task 1: Log Event Types & Query Engine

**Files:**
- Modify: `src/content/types.ts` (append new types; do not alter existing ones)
- Create: `src/engine/logQuery.ts`
- Test: `src/engine/logQuery.test.ts`

**Interfaces:**
- Consumes: nothing from other tasks.
- Produces: `LogSource`, `LogEvent`, `TimeRange`, `QueryPredicate`, `QueryAst`, `QueryParseResult`, `QueryResult` (types); `parseQuery(input: string): QueryParseResult`; `executeQuery(ast: QueryAst, events: LogEvent[], range?: TimeRange): QueryResult`.

- [ ] **Step 1: Append the log types to `src/content/types.ts`**

Add these to the **end** of the existing file. Do not modify the types already there.

```ts
export type LogSource = 'k8s-audit' | 'edr' | 'apiserver' | 'ci-cd';

export interface LogEvent {
  id: string;
  /** ISO 8601, e.g. '2026-08-12T02:14:03Z' */
  timestamp: string;
  source: LogSource;
  message: string;
  fields: Record<string, string>;
  /** Index of the earliest stage at which this event is in the searchable index. */
  arrivesAtStage: number;
  /** Pinning this event reveals this fact. Absent on benign events. */
  revealsFact?: string;
  /** Shown when the event is pinned: why it matters, or why it is routine. */
  analystNote?: string;
}

export interface TimeRange {
  id: string;
  label: string;
  /** ISO 8601, inclusive. */
  startIso: string;
  /** ISO 8601, exclusive. */
  endIso: string;
}

export interface QueryPredicate {
  field: string;
  value: string;
  negated: boolean;
}

export interface QueryAst {
  predicates: QueryPredicate[];
  /** Unqualified tokens, matched as substrings against every field value. */
  terms: string[];
}

export type QueryParseResult =
  | { ok: true; ast: QueryAst }
  | { ok: false; error: string };

export interface QueryResult {
  events: LogEvent[];
  /** Predicate fields no visible event carries — surfaced as a UI warning. */
  unknownFields: string[];
}
```

- [ ] **Step 2: Write the failing parser tests**

`src/engine/logQuery.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { parseQuery, executeQuery } from './logQuery';
import type { LogEvent, TimeRange } from '@/content/types';

describe('parseQuery', () => {
  it('parses a single field predicate', () => {
    const result = parseQuery('source=k8s-audit');
    expect(result).toEqual({
      ok: true,
      ast: { predicates: [{ field: 'source', value: 'k8s-audit', negated: false }], terms: [] },
    });
  });

  it('ANDs multiple predicates together', () => {
    const result = parseQuery('source=k8s-audit verb=get');
    expect(result.ok && result.ast.predicates).toHaveLength(2);
  });

  it('parses a quoted value containing spaces', () => {
    const result = parseQuery('message="exec session started"');
    expect(result.ok && result.ast.predicates[0].value).toBe('exec session started');
  });

  it('parses a negated predicate', () => {
    const result = parseQuery('-user=system:kube-scheduler');
    expect(result.ok && result.ast.predicates[0]).toEqual({
      field: 'user',
      value: 'system:kube-scheduler',
      negated: true,
    });
  });

  it('collects unqualified tokens as bare terms', () => {
    const result = parseQuery('ci-deploy-bot source=edr');
    expect(result.ok && result.ast.terms).toEqual(['ci-deploy-bot']);
  });

  it('treats an empty query as matching everything', () => {
    expect(parseQuery('   ')).toEqual({ ok: true, ast: { predicates: [], terms: [] } });
  });

  it('reports a named error for a field with no value', () => {
    const result = parseQuery('user=');
    expect(result).toEqual({ ok: false, error: 'Missing value for field "user".' });
  });

  it('reports a named error for a value with no field', () => {
    const result = parseQuery('=ci-deploy-bot');
    expect(result).toEqual({ ok: false, error: 'Missing field name before "=".' });
  });

  it('reports a named error for an unterminated quote', () => {
    const result = parseQuery('message="never closed');
    expect(result).toEqual({ ok: false, error: 'Unterminated quote in query.' });
  });
});

const events: LogEvent[] = [
  {
    id: 'e1',
    timestamp: '2026-08-12T02:14:03Z',
    source: 'edr',
    message: 'process /bin/sh spawned',
    fields: { pod: 'ci-deploy-bot-7f9c4d6b6-x2k1p', severity: 'high' },
    arrivesAtStage: 0,
    revealsFact: 'evidence-interactive-shell',
  },
  {
    id: 'e2',
    timestamp: '2026-08-12T02:20:00Z',
    source: 'k8s-audit',
    message: 'get configmaps',
    fields: { user: 'system:kube-scheduler', verb: 'get' },
    arrivesAtStage: 0,
  },
  {
    id: 'e3',
    timestamp: '2025-06-14T09:22:00Z',
    source: 'k8s-audit',
    message: 'create clusterrolebinding',
    fields: { user: 'alice@mangocorp.example', verb: 'create' },
    arrivesAtStage: 0,
  },
];

const lastHour: TimeRange = {
  id: 'last-1h',
  label: 'Last hour',
  startIso: '2026-08-12T02:00:00Z',
  endIso: '2026-08-12T03:00:00Z',
};

describe('executeQuery', () => {
  it('returns every event for an empty query', () => {
    const ast = { predicates: [], terms: [] };
    expect(executeQuery(ast, events).events).toHaveLength(3);
  });

  it('filters by the synthetic `source` field', () => {
    const ast = { predicates: [{ field: 'source', value: 'edr', negated: false }], terms: [] };
    expect(executeQuery(ast, events).events.map((e) => e.id)).toEqual(['e1']);
  });

  it('matches field values case-insensitively as substrings', () => {
    const ast = { predicates: [{ field: 'pod', value: 'CI-DEPLOY-BOT', negated: false }], terms: [] };
    expect(executeQuery(ast, events).events.map((e) => e.id)).toEqual(['e1']);
  });

  it('excludes matches for a negated predicate', () => {
    const ast = {
      predicates: [{ field: 'user', value: 'system:kube-scheduler', negated: true }],
      terms: [],
    };
    expect(executeQuery(ast, events).events.map((e) => e.id)).toEqual(['e1', 'e3']);
  });

  it('matches bare terms against message and field values', () => {
    const ast = { predicates: [], terms: ['spawned'] };
    expect(executeQuery(ast, events).events.map((e) => e.id)).toEqual(['e1']);
  });

  it('restricts results to the supplied time range', () => {
    const ast = { predicates: [], terms: [] };
    expect(executeQuery(ast, events, lastHour).events.map((e) => e.id)).toEqual(['e2', 'e1']);
  });

  it('reports predicate fields that no event carries', () => {
    const ast = { predicates: [{ field: 'usr', value: 'x', negated: false }], terms: [] };
    expect(executeQuery(ast, events).unknownFields).toEqual(['usr']);
  });

  it('sorts results newest first', () => {
    const ast = { predicates: [], terms: [] };
    expect(executeQuery(ast, events).events.map((e) => e.id)).toEqual(['e2', 'e1', 'e3']);
  });
});
```

- [ ] **Step 3: Run the tests and verify they fail**

Run: `npm run test -- src/engine/logQuery.test.ts`
Expected: FAIL — cannot find module `./logQuery`.

- [ ] **Step 4: Implement the query engine**

`src/engine/logQuery.ts`:

```ts
import type {
  LogEvent,
  QueryAst,
  QueryParseResult,
  QueryPredicate,
  QueryResult,
  TimeRange,
} from '@/content/types';

/**
 * Splits on whitespace, but keeps double-quoted runs together so
 * `message="exec session started"` survives as a single token.
 */
function tokenize(input: string): string[] | null {
  const tokens: string[] = [];
  let current = '';
  let inQuotes = false;

  for (const char of input) {
    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (!inQuotes && /\s/.test(char)) {
      if (current) tokens.push(current);
      current = '';
      continue;
    }
    current += char;
  }

  if (inQuotes) return null;
  if (current) tokens.push(current);
  return tokens;
}

export function parseQuery(input: string): QueryParseResult {
  const tokens = tokenize(input.trim());
  if (tokens === null) return { ok: false, error: 'Unterminated quote in query.' };

  const predicates: QueryPredicate[] = [];
  const terms: string[] = [];

  for (const token of tokens) {
    const negated = token.startsWith('-');
    const body = negated ? token.slice(1) : token;
    const equalsAt = body.indexOf('=');

    if (equalsAt === -1) {
      terms.push(body);
      continue;
    }

    const field = body.slice(0, equalsAt);
    const value = body.slice(equalsAt + 1);
    if (!field) return { ok: false, error: 'Missing field name before "=".' };
    if (!value) return { ok: false, error: `Missing value for field "${field}".` };

    predicates.push({ field, value, negated });
  }

  return { ok: true, ast: { predicates, terms } };
}

/**
 * `source` and `message` are promoted to queryable fields so players can
 * write `source=edr` without the content author duplicating them into
 * every event's `fields` bag.
 */
function fieldValue(event: LogEvent, field: string): string | undefined {
  if (field === 'source') return event.source;
  if (field === 'message') return event.message;
  return event.fields[field];
}

function searchableText(event: LogEvent): string {
  return [event.source, event.message, ...Object.values(event.fields)].join(' ');
}

function matches(event: LogEvent, ast: QueryAst): boolean {
  for (const predicate of ast.predicates) {
    const value = fieldValue(event, predicate.field);
    const hit =
      value !== undefined && value.toLowerCase().includes(predicate.value.toLowerCase());
    if (hit === predicate.negated) return false;
  }

  const haystack = searchableText(event).toLowerCase();
  return ast.terms.every((term) => haystack.includes(term.toLowerCase()));
}

function inRange(event: LogEvent, range: TimeRange | undefined): boolean {
  if (!range) return true;
  const at = Date.parse(event.timestamp);
  return at >= Date.parse(range.startIso) && at < Date.parse(range.endIso);
}

export function executeQuery(
  ast: QueryAst,
  events: LogEvent[],
  range?: TimeRange
): QueryResult {
  const inWindow = events.filter((event) => inRange(event, range));

  const unknownFields = ast.predicates
    .map((predicate) => predicate.field)
    .filter(
      (field, index, all) =>
        all.indexOf(field) === index &&
        !inWindow.some((event) => fieldValue(event, field) !== undefined)
    );

  const matched = inWindow
    .filter((event) => matches(event, ast))
    .sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp));

  return { events: matched, unknownFields };
}
```

- [ ] **Step 5: Run the tests and verify they pass**

Run: `npm run test -- src/engine/logQuery.test.ts`
Expected: PASS (17 tests).

- [ ] **Step 6: Commit**

```bash
git add src/content/types.ts src/engine/logQuery.ts src/engine/logQuery.test.ts
git commit -m "feat: add log event types and Splunk-style query engine"
```

---

### Task 2: Signal Events & Time Ranges

**Files:**
- Create: `src/content/chapter1/logs/signal.ts`
- Create: `src/content/chapter1/logs/timeRanges.ts`
- Test: `src/content/chapter1/logs/signal.test.ts`

**Interfaces:**
- Consumes: `LogEvent`, `TimeRange` (`src/content/types.ts`).
- Produces: `signalEvents: LogEvent[]`; `TIME_RANGES: TimeRange[]`; `DEFAULT_TIME_RANGE_ID: string`; `INCIDENT_NOW_ISO: string`.

**Timeline note for the implementer:** "now" in this fiction is `2026-08-12T03:00:00Z`. The RBAC binding was created **fourteen months earlier** (`2025-06-14`), so it falls outside every time range except `all-time`. That is deliberate: widening the time range is the Stage 2 lesson. Do not move that timestamp into the recent window.

- [ ] **Step 1: Create the time-range presets**

`src/content/chapter1/logs/timeRanges.ts`:

```ts
import type { TimeRange } from '@/content/types';

/** Fixed "current time" for the fiction — keeps every range deterministic. */
export const INCIDENT_NOW_ISO = '2026-08-12T03:00:00Z';

export const TIME_RANGES: TimeRange[] = [
  {
    id: 'last-1h',
    label: 'Last hour',
    startIso: '2026-08-12T02:00:00Z',
    endIso: INCIDENT_NOW_ISO,
  },
  {
    id: 'last-24h',
    label: 'Last 24 hours',
    startIso: '2026-08-11T03:00:00Z',
    endIso: INCIDENT_NOW_ISO,
  },
  {
    id: 'last-30d',
    label: 'Last 30 days',
    startIso: '2026-07-13T03:00:00Z',
    endIso: INCIDENT_NOW_ISO,
  },
  {
    id: 'all-time',
    label: 'All time',
    startIso: '2025-01-01T00:00:00Z',
    endIso: INCIDENT_NOW_ISO,
  },
];

export const DEFAULT_TIME_RANGE_ID = 'last-1h';
```

- [ ] **Step 2: Write the failing signal-event tests**

`src/content/chapter1/logs/signal.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { signalEvents } from './signal';
import { TIME_RANGES } from './timeRanges';

describe('signalEvents', () => {
  it('gives every signal event a fact to reveal and an analyst note', () => {
    for (const event of signalEvents) {
      expect(event.revealsFact, `event ${event.id} has no revealsFact`).toBeTruthy();
      expect(event.analystNote, `event ${event.id} has no analystNote`).toBeTruthy();
    }
  });

  it('uses unique event ids', () => {
    const ids = signalEvents.map((event) => event.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('reveals each fact from exactly one event', () => {
    const facts = signalEvents.map((event) => event.revealsFact);
    expect(new Set(facts).size).toBe(facts.length);
  });

  it('hides the binding-creation event from every range except all-time', () => {
    const origin = signalEvents.find((event) => event.revealsFact === 'evidence-binding-origin');
    expect(origin).toBeDefined();
    const at = Date.parse(origin!.timestamp);
    const visibleIn = TIME_RANGES.filter(
      (range) => at >= Date.parse(range.startIso) && at < Date.parse(range.endIso)
    );
    expect(visibleIn.map((range) => range.id)).toEqual(['all-time']);
  });
});
```

- [ ] **Step 3: Run the tests and verify they fail**

Run: `npm run test -- src/content/chapter1/logs/signal.test.ts`
Expected: FAIL — cannot find module `./signal`.

- [ ] **Step 4: Implement the signal events**

`src/content/chapter1/logs/signal.ts`:

```ts
import type { LogEvent } from '@/content/types';

/**
 * The smoking guns. Each reveals exactly one fact when pinned.
 * `arrivesAtStage` paces a live incident: the attacker is still working
 * while the analyst hunts, so later evidence genuinely does not exist yet.
 *
 * Exception: `evidence-binding-origin` arrives at stage 0 but is dated
 * fourteen months ago, so it is hidden by the default time range instead.
 * Widening the range is the Stage 2 lesson.
 */
export const signalEvents: LogEvent[] = [
  {
    id: 'sig-shell-spawn',
    timestamp: '2026-08-12T02:14:03Z',
    source: 'edr',
    message: 'Interactive shell /bin/sh spawned in container',
    fields: {
      pod: 'ci-deploy-bot-7f9c4d6b6-x2k1p',
      namespace: 'build',
      container: 'deploy-agent',
      process: '/bin/sh',
      parent: 'node /opt/agent/entrypoint.js',
      severity: 'high',
      detection: 'interactive-shell-in-workload',
    },
    arrivesAtStage: 0,
    revealsFact: 'evidence-interactive-shell',
    analystNote:
      'Build agents run scripted, non-interactive jobs. An interactive shell inside one is not how CI behaves — this is a human, or something imitating one.',
  },
  {
    id: 'sig-exec-create',
    timestamp: '2026-08-12T02:14:01Z',
    source: 'k8s-audit',
    message: 'create pods/exec',
    fields: {
      user: 'system:serviceaccount:build:ci-deploy-bot',
      verb: 'create',
      resource: 'pods/exec',
      namespace: 'build',
      pod: 'ci-deploy-bot-7f9c4d6b6-x2k1p',
      sourceIP: '203.0.113.44',
      responseCode: '201',
    },
    arrivesAtStage: 0,
    revealsFact: 'evidence-offhours-exec',
    analystNote:
      'An exec into a pod at 02:14 UTC, from an external source IP, using a CI service account. No pipeline run is scheduled in this window.',
  },
  {
    id: 'sig-sa-out-of-scope',
    timestamp: '2026-08-12T02:14:48Z',
    source: 'k8s-audit',
    message: 'list secrets across all namespaces',
    fields: {
      user: 'system:serviceaccount:build:ci-deploy-bot',
      verb: 'list',
      resource: 'secrets',
      namespace: '*',
      sourceIP: '203.0.113.44',
      responseCode: '200',
    },
    arrivesAtStage: 1,
    revealsFact: 'evidence-sa-identity',
    analystNote:
      'A build account listing secrets in every namespace. The account name looks routine; the scope of what it just did is not.',
  },
  {
    id: 'sig-binding-in-effect',
    timestamp: '2026-08-12T02:14:52Z',
    source: 'apiserver',
    message: 'authorization allowed by ClusterRoleBinding ci-deploy-bot-binding',
    fields: {
      user: 'system:serviceaccount:build:ci-deploy-bot',
      decision: 'allow',
      binding: 'ci-deploy-bot-binding',
      role: 'cluster-admin',
      reason: 'RBAC: allowed by ClusterRoleBinding "ci-deploy-bot-binding"',
    },
    arrivesAtStage: 1,
    revealsFact: 'evidence-clusteradmin-binding',
    analystNote:
      'The authorizer names the binding that permitted it: a CI service account is bound to cluster-admin, the built-in role that can do anything to anything.',
  },
  {
    id: 'sig-binding-origin',
    timestamp: '2025-06-14T09:22:17Z',
    source: 'k8s-audit',
    message: 'create clusterrolebindings/ci-deploy-bot-binding',
    fields: {
      user: 'alice.ferreira@mangocorp.example',
      verb: 'create',
      resource: 'clusterrolebindings',
      object: 'ci-deploy-bot-binding',
      role: 'cluster-admin',
      annotation: 'created-by=jenkins-migration-2024',
      responseCode: '201',
    },
    arrivesAtStage: 0,
    revealsFact: 'evidence-binding-origin',
    analystNote:
      'Fourteen months old, created by a migration script, never revisited. The breach is days old; the misconfiguration that made it possible is not.',
  },
  {
    id: 'sig-secret-read',
    timestamp: '2026-08-12T02:15:12Z',
    source: 'k8s-audit',
    message: 'get secrets/ultra-mango-genome-db',
    fields: {
      user: 'system:serviceaccount:build:ci-deploy-bot',
      verb: 'get',
      resource: 'secrets',
      object: 'ultra-mango-genome-db',
      namespace: 'product',
      sourceIP: '203.0.113.44',
      responseCode: '200',
    },
    arrivesAtStage: 2,
    revealsFact: 'evidence-secret-read',
    analystNote:
      'The Ultra Mango cultivar genome. A build account in the build namespace has no reason to read a product-namespace secret, and it succeeded.',
  },
  {
    id: 'sig-exfil-egress',
    timestamp: '2026-08-12T02:16:40Z',
    source: 'edr',
    message: 'Outbound connection to unrecognized external host',
    fields: {
      pod: 'ci-deploy-bot-7f9c4d6b6-x2k1p',
      namespace: 'build',
      process: 'curl',
      remoteIP: '203.0.113.44',
      remotePort: '443',
      bytesOut: '2841160',
      severity: 'high',
    },
    arrivesAtStage: 2,
    revealsFact: 'evidence-exfil-egress',
    analystNote:
      '2.8 MB leaving the cluster to the same IP that opened the shell, ninety seconds after the genome secret was read. Access became exfiltration here.',
  },
  {
    id: 'sig-rogue-sa',
    timestamp: '2026-08-12T02:31:07Z',
    source: 'k8s-audit',
    message: 'create serviceaccounts/log-rotator',
    fields: {
      user: 'system:serviceaccount:build:ci-deploy-bot',
      verb: 'create',
      resource: 'serviceaccounts',
      object: 'log-rotator',
      namespace: 'kube-system',
      sourceIP: '203.0.113.44',
      responseCode: '201',
    },
    arrivesAtStage: 3,
    revealsFact: 'evidence-rogue-sa',
    analystNote:
      'A new service account in kube-system, named to look like routine maintenance. Nothing in MangoCorp created this.',
  },
  {
    id: 'sig-rogue-binding',
    timestamp: '2026-08-12T02:31:22Z',
    source: 'k8s-audit',
    message: 'create clusterrolebindings/log-rotator-admin',
    fields: {
      user: 'system:serviceaccount:build:ci-deploy-bot',
      verb: 'create',
      resource: 'clusterrolebindings',
      object: 'log-rotator-admin',
      role: 'cluster-admin',
      sourceIP: '203.0.113.44',
      responseCode: '201',
    },
    arrivesAtStage: 3,
    revealsFact: 'evidence-rogue-binding',
    analystNote:
      'A second path to cluster-admin, independent of ci-deploy-bot. Revoking only the first binding would have left this one untouched.',
  },
];
```

- [ ] **Step 5: Run the tests and verify they pass**

Run: `npm run test -- src/content/chapter1/logs/signal.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 6: Commit**

```bash
git add src/content/chapter1/logs/signal.ts src/content/chapter1/logs/timeRanges.ts src/content/chapter1/logs/signal.test.ts
git commit -m "feat: add Chapter 1 signal log events and time-range presets"
```

---

### Task 3: Deterministic Noise Generator & Corpus Assembly

**Files:**
- Create: `src/content/chapter1/logs/noise.ts`
- Create: `src/content/chapter1/logs/index.ts`
- Test: `src/content/chapter1/logs/corpus.test.ts`

**Interfaces:**
- Consumes: `LogEvent` (`src/content/types.ts`); `signalEvents` (`./signal`); `TIME_RANGES` (`./timeRanges`).
- Produces: `generateNoiseEvents(options: { count: number; startIso: string; endIso: string; seed: number; idPrefix: string }): LogEvent[]`; `sentinelLogCorpus: LogEvent[]`; re-exports `TIME_RANGES`, `DEFAULT_TIME_RANGE_ID`.

**Why this matters:** the corpus must read like a real index — mostly boring. Critically, the noise includes **legitimate `ci-deploy-bot` activity** scoped to the build namespace. The player cannot find the attacker by searching the account name alone; they have to notice that the *scope* of certain actions is wrong. Do not remove those benign entries to make the hunt easier.

- [ ] **Step 1: Write the failing corpus tests**

`src/content/chapter1/logs/corpus.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { generateNoiseEvents } from './noise';
import { sentinelLogCorpus } from './index';
import { signalEvents } from './signal';
import { TIME_RANGES } from './timeRanges';

describe('generateNoiseEvents', () => {
  const options = {
    count: 50,
    startIso: '2026-08-12T02:00:00Z',
    endIso: '2026-08-12T03:00:00Z',
    seed: 7,
    idPrefix: 'test',
  };

  it('generates exactly the requested number of events', () => {
    expect(generateNoiseEvents(options)).toHaveLength(50);
  });

  it('is deterministic for a given seed', () => {
    expect(generateNoiseEvents(options)).toEqual(generateNoiseEvents(options));
  });

  it('produces different output for a different seed', () => {
    const other = generateNoiseEvents({ ...options, seed: 8 });
    expect(other).not.toEqual(generateNoiseEvents(options));
  });

  it('places every event inside the requested window', () => {
    for (const event of generateNoiseEvents(options)) {
      const at = Date.parse(event.timestamp);
      expect(at).toBeGreaterThanOrEqual(Date.parse(options.startIso));
      expect(at).toBeLessThan(Date.parse(options.endIso));
    }
  });

  it('never reveals a fact', () => {
    for (const event of generateNoiseEvents(options)) {
      expect(event.revealsFact).toBeUndefined();
    }
  });

  it('always explains why an event is routine', () => {
    for (const event of generateNoiseEvents(options)) {
      expect(event.analystNote).toBeTruthy();
    }
  });
});

describe('sentinelLogCorpus', () => {
  it('uses unique ids across noise and signal', () => {
    const ids = sentinelLogCorpus.map((event) => event.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('contains every signal event', () => {
    for (const signal of signalEvents) {
      expect(sentinelLogCorpus.some((event) => event.id === signal.id)).toBe(true);
    }
  });

  it('includes benign ci-deploy-bot activity so the account name alone is not the tell', () => {
    const benign = sentinelLogCorpus.filter(
      (event) =>
        !event.revealsFact &&
        Object.values(event.fields).some((value) => value.includes('ci-deploy-bot'))
    );
    expect(benign.length).toBeGreaterThan(10);
  });

  it('keeps signal under 5% of visible events at every stage', () => {
    for (let stageIndex = 0; stageIndex < 5; stageIndex += 1) {
      const visible = sentinelLogCorpus.filter((event) => event.arrivesAtStage <= stageIndex);
      const signal = visible.filter((event) => event.revealsFact);
      const ratio = signal.length / visible.length;
      expect(ratio, `stage ${stageIndex} signal ratio ${ratio}`).toBeLessThan(0.05);
    }
  });

  it('keeps signal under 5% within the default one-hour range too', () => {
    const range = TIME_RANGES.find((candidate) => candidate.id === 'last-1h')!;
    const visible = sentinelLogCorpus.filter((event) => {
      const at = Date.parse(event.timestamp);
      return at >= Date.parse(range.startIso) && at < Date.parse(range.endIso);
    });
    const signal = visible.filter((event) => event.revealsFact);
    expect(signal.length / visible.length).toBeLessThan(0.05);
  });
});
```

- [ ] **Step 2: Run the tests and verify they fail**

Run: `npm run test -- src/content/chapter1/logs/corpus.test.ts`
Expected: FAIL — cannot find module `./noise`.

- [ ] **Step 3: Implement the noise generator**

`src/content/chapter1/logs/noise.ts`:

```ts
import type { LogEvent, LogSource } from '@/content/types';

/**
 * Mulberry32 — a tiny seeded PRNG. Determinism matters more than
 * statistical quality here: the same seed must always produce the same
 * corpus so tests and playthroughs are stable.
 */
function createRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface NoiseTemplate {
  source: LogSource;
  message: string;
  fields: Record<string, string>;
  analystNote: string;
}

const NOISE_TEMPLATES: NoiseTemplate[] = [
  {
    source: 'k8s-audit',
    message: 'get configmaps/logistics-routing',
    fields: {
      user: 'system:serviceaccount:logistics:route-planner',
      verb: 'get',
      resource: 'configmaps',
      namespace: 'logistics',
      responseCode: '200',
    },
    analystNote: 'A workload reading its own config in its own namespace. Routine.',
  },
  {
    source: 'k8s-audit',
    message: 'watch leases/kube-scheduler',
    fields: {
      user: 'system:kube-scheduler',
      verb: 'watch',
      resource: 'leases',
      namespace: 'kube-system',
      responseCode: '200',
    },
    analystNote: 'Control-plane leader election. This never stops.',
  },
  {
    source: 'k8s-audit',
    message: 'create pods/inventory-sync',
    fields: {
      user: 'system:serviceaccount:kube-system:deployment-controller',
      verb: 'create',
      resource: 'pods',
      namespace: 'logistics',
      responseCode: '201',
    },
    analystNote: 'The deployment controller replacing a pod. Normal cluster churn.',
  },
  {
    source: 'k8s-audit',
    message: 'update deployments/pricing-api',
    fields: {
      user: 'system:serviceaccount:build:ci-deploy-bot',
      verb: 'update',
      resource: 'deployments',
      namespace: 'build',
      responseCode: '200',
    },
    analystNote:
      'ci-deploy-bot deploying inside the build namespace — exactly what a CI account is supposed to do. The account is not the anomaly; scope is.',
  },
  {
    source: 'k8s-audit',
    message: 'get pods/ci-deploy-bot-7f9c4d6b6-x2k1p',
    fields: {
      user: 'system:serviceaccount:build:ci-deploy-bot',
      verb: 'get',
      resource: 'pods',
      namespace: 'build',
      responseCode: '200',
    },
    analystNote: 'A build job checking its own pod status. Routine.',
  },
  {
    source: 'edr',
    message: 'Process node spawned in container',
    fields: {
      pod: 'pricing-api-6b7c8d9-q3n4r',
      namespace: 'product',
      process: 'node',
      parent: 'containerd-shim',
      severity: 'informational',
    },
    analystNote: 'A Node.js service starting up. Expected at container start.',
  },
  {
    source: 'edr',
    message: 'Process npm spawned in container',
    fields: {
      pod: 'ci-deploy-bot-7f9c4d6b6-x2k1p',
      namespace: 'build',
      process: 'npm',
      parent: 'node /opt/agent/entrypoint.js',
      severity: 'informational',
    },
    analystNote:
      'The build agent running npm as a child of its own entrypoint — a scripted, non-interactive job. Compare this parent chain to an interactive shell.',
  },
  {
    source: 'edr',
    message: 'Outbound connection to registry.mangocorp.internal',
    fields: {
      pod: 'ci-deploy-bot-7f9c4d6b6-x2k1p',
      namespace: 'build',
      process: 'containerd',
      remoteIP: '10.42.0.19',
      remotePort: '443',
      severity: 'informational',
    },
    analystNote: 'An image pull from the internal registry. Internal IP, expected port.',
  },
  {
    source: 'apiserver',
    message: 'GET /api/v1/namespaces/logistics/pods',
    fields: {
      user: 'system:serviceaccount:monitoring:prometheus',
      decision: 'allow',
      status: '200',
      latencyMs: '12',
    },
    analystNote: 'Prometheus scraping pod metadata on its usual interval.',
  },
  {
    source: 'apiserver',
    message: 'GET /healthz',
    fields: {
      user: 'system:anonymous',
      decision: 'allow',
      status: '200',
      latencyMs: '1',
    },
    analystNote: 'A load-balancer health probe. Anonymous by design on this endpoint.',
  },
  {
    source: 'ci-cd',
    message: 'pipeline stage completed: build',
    fields: {
      pipeline: 'mangocorp/logistics-api',
      stage: 'build',
      result: 'success',
      actor: 'ci-deploy-bot',
      durationSec: '94',
    },
    analystNote: 'A green build during working hours. Nothing to see.',
  },
  {
    source: 'ci-cd',
    message: 'pipeline stage completed: push-image',
    fields: {
      pipeline: 'mangocorp/pricing-api',
      stage: 'push-image',
      result: 'success',
      actor: 'ci-deploy-bot',
      durationSec: '31',
    },
    analystNote: 'An image push to the internal registry at the end of a successful build.',
  },
];

export interface NoiseOptions {
  count: number;
  startIso: string;
  endIso: string;
  seed: number;
  idPrefix: string;
}

export function generateNoiseEvents(options: NoiseOptions): LogEvent[] {
  const random = createRandom(options.seed);
  const start = Date.parse(options.startIso);
  const span = Date.parse(options.endIso) - start;

  return Array.from({ length: options.count }, (_unused, index) => {
    const template = NOISE_TEMPLATES[Math.floor(random() * NOISE_TEMPLATES.length)];
    const at = new Date(start + Math.floor(random() * span));

    return {
      id: `${options.idPrefix}-${index}`,
      timestamp: at.toISOString().replace(/\.\d{3}Z$/, 'Z'),
      source: template.source,
      message: template.message,
      fields: { ...template.fields },
      arrivesAtStage: 0,
      analystNote: template.analystNote,
    } satisfies LogEvent;
  });
}
```

- [ ] **Step 4: Assemble the corpus**

`src/content/chapter1/logs/index.ts`:

```ts
import type { LogEvent } from '@/content/types';
import { generateNoiseEvents } from './noise';
import { signalEvents } from './signal';

export { TIME_RANGES, DEFAULT_TIME_RANGE_ID, INCIDENT_NOW_ISO } from './timeRanges';

/**
 * Noise is weighted toward the recent window so the default one-hour
 * range is dense enough to hunt in, with a thinner historical tail that
 * only appears once the analyst widens the range.
 */
const noiseEvents: LogEvent[] = [
  ...generateNoiseEvents({
    // Sized against the 5% signal ceiling in corpus.test.ts, not chosen
    // arbitrarily: 8 of the 9 signal events fall in the default one-hour
    // window, so 200 puts that window at 3.85% with room for two more
    // signal events. Lowering this silently breaks the ratio test.
    count: 200,
    startIso: '2026-08-12T02:00:00Z',
    endIso: '2026-08-12T03:00:00Z',
    seed: 1337,
    idPrefix: 'noise-recent',
  }),
  ...generateNoiseEvents({
    count: 120,
    startIso: '2026-08-11T03:00:00Z',
    endIso: '2026-08-12T02:00:00Z',
    seed: 4242,
    idPrefix: 'noise-day',
  }),
  ...generateNoiseEvents({
    count: 90,
    startIso: '2025-06-01T00:00:00Z',
    endIso: '2026-07-13T03:00:00Z',
    seed: 9001,
    idPrefix: 'noise-history',
  }),
];

export const sentinelLogCorpus: LogEvent[] = [...noiseEvents, ...signalEvents];
```

- [ ] **Step 5: Run the tests and verify they pass**

Run: `npm run test -- src/content/chapter1/logs/corpus.test.ts`
Expected: PASS (11 tests).

- [ ] **Step 6: Commit**

```bash
git add src/content/chapter1/logs/noise.ts src/content/chapter1/logs/index.ts src/content/chapter1/logs/corpus.test.ts
git commit -m "feat: add deterministic log noise generator and corpus assembly"
```

---

### Task 4: Attack Map Content & State Derivation

**Files:**
- Modify: `src/content/types.ts` (append attack-map types)
- Create: `src/content/chapter1/attackMap.ts`
- Test: `src/content/chapter1/attackMap.test.ts`

**Interfaces:**
- Consumes: `LogEvent` (for the evidence cross-check test).
- Produces: `AttackMapNodeState`, `AttackMapNode` (types); `sentinelAttackMap: AttackMapNode[]`; `deriveNodeState(node: AttackMapNode, facts: ReadonlySet<string>): AttackMapNodeState`.

- [ ] **Step 1: Append the attack-map types to `src/content/types.ts`**

Add to the end of the file:

```ts
export type AttackMapNodeState = 'undiscovered' | 'suspected' | 'confirmed' | 'contained';

export interface AttackMapNode {
  id: string;
  label: string;
  /** Plain-language tactic name, e.g. 'Privilege Escalation'. */
  tactic: string;
  summary: string;
  lesson: string;
  prevention: string;
  /** Every listed fact must be collected for the state to apply. Empty = never. */
  suspectedByFacts: string[];
  confirmedByFacts: string[];
  containedByFacts: string[];
  /** Layout position along the branch, in the map's 0-100 coordinate space. */
  x: number;
  y: number;
  /** Branch parent; absent on the trunk node. */
  parentId?: string;
}
```

- [ ] **Step 2: Write the failing attack-map tests**

`src/content/chapter1/attackMap.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { sentinelAttackMap, deriveNodeState } from './attackMap';

describe('deriveNodeState', () => {
  const node = {
    id: 'n',
    label: 'n',
    tactic: 't',
    summary: 's',
    lesson: 'l',
    prevention: 'p',
    suspectedByFacts: ['a'],
    confirmedByFacts: ['a', 'b'],
    containedByFacts: ['c'],
    x: 0,
    y: 0,
  };

  it('is undiscovered with no facts', () => {
    expect(deriveNodeState(node, new Set())).toBe('undiscovered');
  });

  it('is suspected once the suspecting facts are all collected', () => {
    expect(deriveNodeState(node, new Set(['a']))).toBe('suspected');
  });

  it('is confirmed once the confirming facts are all collected', () => {
    expect(deriveNodeState(node, new Set(['a', 'b']))).toBe('confirmed');
  });

  it('is contained once the containing facts are all collected', () => {
    expect(deriveNodeState(node, new Set(['a', 'b', 'c']))).toBe('contained');
  });

  it('treats an empty fact list as never triggering', () => {
    const never = { ...node, suspectedByFacts: [], confirmedByFacts: [], containedByFacts: [] };
    expect(deriveNodeState(never, new Set(['a', 'b', 'c']))).toBe('undiscovered');
  });
});

describe('sentinelAttackMap', () => {
  it('uses unique node ids', () => {
    const ids = sentinelAttackMap.map((node) => node.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('points every parentId at a node that exists', () => {
    const ids = new Set(sentinelAttackMap.map((node) => node.id));
    for (const node of sentinelAttackMap) {
      if (node.parentId) {
        expect(ids.has(node.parentId), `${node.id} has unknown parent ${node.parentId}`).toBe(true);
      }
    }
  });

  it('has exactly one trunk node', () => {
    expect(sentinelAttackMap.filter((node) => !node.parentId)).toHaveLength(1);
  });

  it('gives every node a lesson and a prevention', () => {
    for (const node of sentinelAttackMap) {
      expect(node.lesson, `${node.id} has no lesson`).toBeTruthy();
      expect(node.prevention, `${node.id} has no prevention`).toBeTruthy();
    }
  });
});
```

- [ ] **Step 3: Run the tests and verify they fail**

Run: `npm run test -- src/content/chapter1/attackMap.test.ts`
Expected: FAIL — cannot find module `./attackMap`.

- [ ] **Step 4: Implement the attack map**

`src/content/chapter1/attackMap.ts`:

```ts
import type { AttackMapNode, AttackMapNodeState } from '@/content/types';

function satisfied(required: string[], facts: ReadonlySet<string>): boolean {
  return required.length > 0 && required.every((factId) => facts.has(factId));
}

export function deriveNodeState(
  node: AttackMapNode,
  facts: ReadonlySet<string>
): AttackMapNodeState {
  if (satisfied(node.containedByFacts, facts)) return 'contained';
  if (satisfied(node.confirmedByFacts, facts)) return 'confirmed';
  if (satisfied(node.suspectedByFacts, facts)) return 'suspected';
  return 'undiscovered';
}

/**
 * The kill chain, drawn as a branch: the trunk is how they got in, and
 * each limb is a tactic. `initial-access` is deliberately never
 * confirmable in Chapter 1 — the supply-chain compromise is Chapter 2.
 */
export const sentinelAttackMap: AttackMapNode[] = [
  {
    id: 'initial-access',
    label: 'Poisoned build image',
    tactic: 'Initial Access',
    summary:
      'Something was already inside the CI image before this incident began. The audit trail starts after the implant was planted, so the entry point is inferred, not proven.',
    lesson:
      'Not every incident yields a confirmed patient zero. An unexplained foothold in a build workload is itself a finding — it points upstream, at the pipeline that produced the image.',
    prevention:
      'Sign and verify images, pin base-image digests, and generate an SBOM per build so a poisoned dependency can be traced after the fact.',
    suspectedByFacts: ['evidence-interactive-shell'],
    confirmedByFacts: [],
    containedByFacts: [],
    x: 10,
    y: 78,
  },
  {
    id: 'execution',
    label: 'Interactive shell in build pod',
    tactic: 'Execution',
    summary:
      'An interactive /bin/sh ran inside ci-deploy-bot at 02:14 UTC, opened via the Kubernetes exec API from an external address.',
    lesson:
      'Build agents run scripted, non-interactive work. An interactive shell in one is a high-signal anomaly, and the exec API call leaves a matching record in the audit log.',
    prevention:
      'Alert on create pods/exec in production namespaces, and drop shells from workload images so there is nothing interactive to spawn.',
    suspectedByFacts: ['evidence-offhours-exec'],
    confirmedByFacts: ['evidence-interactive-shell', 'evidence-offhours-exec'],
    containedByFacts: ['removed-implant-pod'],
    x: 30,
    y: 62,
    parentId: 'initial-access',
  },
  {
    id: 'privilege-escalation',
    label: 'CI account bound to cluster-admin',
    tactic: 'Privilege Escalation',
    summary:
      'ci-deploy-bot was bound directly to the built-in cluster-admin ClusterRole by a migration script fourteen months before the breach.',
    lesson:
      'The attacker did not escalate privileges — the cluster handed them over. A shortcut taken during a pipeline migration turned a single compromised build pod into full cluster control.',
    prevention:
      'Scope service accounts to the verbs and resources they actually need, and audit ClusterRoleBindings to cluster-admin on a schedule so migration-era shortcuts get found.',
    suspectedByFacts: ['evidence-sa-identity'],
    confirmedByFacts: ['evidence-clusteradmin-binding', 'evidence-binding-origin'],
    containedByFacts: ['revoked-primary-binding'],
    x: 50,
    y: 44,
    parentId: 'execution',
  },
  {
    id: 'credential-access',
    label: 'Cultivar genome secret read',
    tactic: 'Credential & Data Access',
    summary:
      'The ultra-mango-genome-db secret in the product namespace was read at 02:15:12 by the build service account.',
    lesson:
      'Cluster-admin flattens namespace boundaries. Isolation that exists only as a namespace is not isolation once an account can read across all of them.',
    prevention:
      'Keep high-value material out of plain Kubernetes Secrets — use an external secrets manager with its own authorization and short-lived leases.',
    suspectedByFacts: [],
    confirmedByFacts: ['evidence-secret-read'],
    containedByFacts: ['rotated-secret'],
    x: 72,
    y: 28,
    parentId: 'privilege-escalation',
  },
  {
    id: 'exfiltration',
    label: 'Genome data egress',
    tactic: 'Exfiltration',
    summary:
      '2.8 MB left the build pod for 203.0.113.44 at 02:16:40, ninety seconds after the secret was read — the same address that opened the shell.',
    lesson:
      'Control-plane access and endpoint telemetry answer different questions. The audit log proves the secret was read; only the egress record proves it left.',
    prevention:
      'Apply default-deny egress NetworkPolicies to build workloads and alert on unrecognized outbound destinations from cluster nodes.',
    suspectedByFacts: [],
    confirmedByFacts: ['evidence-exfil-egress'],
    containedByFacts: [],
    x: 90,
    y: 14,
    parentId: 'credential-access',
  },
  {
    id: 'persistence',
    label: 'Rogue cluster-admin account',
    tactic: 'Persistence',
    summary:
      'A log-rotator service account and a log-rotator-admin cluster-admin binding were created in kube-system at 02:31 — a second way in, independent of ci-deploy-bot.',
    lesson:
      'Containment that stops at the entry point is not eradication. An attacker with cluster-admin creates their own identities, so hunting persistence has to precede revocation.',
    prevention:
      'Alert on ClusterRoleBinding and ServiceAccount creation in kube-system, and require review for any new binding to cluster-admin.',
    suspectedByFacts: ['evidence-rogue-sa'],
    confirmedByFacts: ['evidence-rogue-sa', 'evidence-rogue-binding'],
    containedByFacts: ['revoked-persistence-binding', 'removed-rogue-sa'],
    x: 66,
    y: 66,
    parentId: 'privilege-escalation',
  },
];
```

- [ ] **Step 5: Run the tests and verify they pass**

Run: `npm run test -- src/content/chapter1/attackMap.test.ts`
Expected: PASS (9 tests).

The cross-check that every fact referenced here exists in the campaign's
fact library is added in Task 7, once the rewritten Sentinel campaign
defines those facts.

- [ ] **Step 6: Commit**

```bash
git add src/content/types.ts src/content/chapter1/attackMap.ts src/content/chapter1/attackMap.test.ts
git commit -m "feat: add Chapter 1 attack map content and node state derivation"
```

---

### Task 5: Extended Reachability Validator

**Files:**
- Modify: `src/content/types.ts` (extend `Stage` and `Campaign`)
- Modify: `src/engine/reachability.ts`
- Test: `src/engine/reachability.test.ts` (add cases; keep the existing three passing)

**Interfaces:**
- Consumes: `Stage`, `LogEvent` (`src/content/types.ts`).
- Produces: `findAdvancePath(stage: Stage, options?: { events?: LogEvent[]; stageIndex?: number }): string[] | null`.

**Why the signature uses an optional argument:** the Infiltrator campaign's existing tests call `findAdvancePath(stage)` with one argument. That call must keep working unchanged.

- [ ] **Step 1: Extend `Stage` and `Campaign` in `src/content/types.ts`**

Replace the existing `Stage` interface with this version (the first six fields are unchanged):

```ts
export interface Stage {
  id: string;
  title: string;
  briefing: string[];
  objective: string;
  commands: CommandDefinition[];
  clusterInitial: ClusterDelta;
  /** Stage completes once every listed fact is collected. */
  advanceWhen?: { facts: string[] };
  /** Clickable chips that insert real query syntax into the search bar. */
  suggestedQueries?: QuerySuggestion[];
  /** Offered after repeated empty result sets. */
  hint?: string;
}

export interface QuerySuggestion {
  label: string;
  query: string;
}
```

Replace the existing `Campaign` interface with:

```ts
export interface Campaign {
  id: CampaignId;
  title: string;
  tagline: string;
  stages: Stage[];
  factLibrary: Record<string, Fact>;
  debrief: CampaignDebrief;
  /** Present only on campaigns that use the log explorer. */
  logCorpus?: LogEvent[];
  attackMap?: AttackMapNode[];
  timeRanges?: TimeRange[];
}
```

- [ ] **Step 2: Add the failing reachability tests**

In `src/engine/reachability.test.ts`, change the type import to:

```ts
import type { LogEvent, Stage } from '@/content/types';
```

Then append these cases inside the existing `describe('findAdvancePath', ...)` block:

```ts
  it('advances via advanceWhen once pinnable events supply the facts', () => {
    const stage: Stage = {
      id: 's',
      title: 't',
      briefing: [],
      objective: 'o',
      clusterInitial: {},
      commands: [],
      advanceWhen: { facts: ['f1', 'f2'] },
    };
    const events: LogEvent[] = [
      {
        id: 'ev1',
        timestamp: '2026-08-12T02:00:00Z',
        source: 'edr',
        message: 'm',
        fields: {},
        arrivesAtStage: 0,
        revealsFact: 'f1',
      },
      {
        id: 'ev2',
        timestamp: '2026-08-12T02:01:00Z',
        source: 'k8s-audit',
        message: 'm',
        fields: {},
        arrivesAtStage: 0,
        revealsFact: 'f2',
      },
    ];
    expect(findAdvancePath(stage, { events, stageIndex: 0 })).toEqual(['pin ev1', 'pin ev2']);
  });

  it('ignores events that have not arrived yet', () => {
    const stage: Stage = {
      id: 's',
      title: 't',
      briefing: [],
      objective: 'o',
      clusterInitial: {},
      commands: [],
      advanceWhen: { facts: ['f1'] },
    };
    const events: LogEvent[] = [
      {
        id: 'ev-late',
        timestamp: '2026-08-12T02:00:00Z',
        source: 'edr',
        message: 'm',
        fields: {},
        arrivesAtStage: 3,
        revealsFact: 'f1',
      },
    ];
    expect(findAdvancePath(stage, { events, stageIndex: 0 })).toBeNull();
  });

  it('combines evidence and commands to reach a gated advancing command', () => {
    const stage: Stage = {
      id: 's',
      title: 't',
      briefing: [],
      objective: 'o',
      clusterInitial: {},
      commands: [
        {
          match: /^respond$/,
          description: 'respond',
          requiresFacts: ['f1'],
          outcome: { output: [], advances: true },
        },
      ],
    };
    const events: LogEvent[] = [
      {
        id: 'ev1',
        timestamp: '2026-08-12T02:00:00Z',
        source: 'edr',
        message: 'm',
        fields: {},
        arrivesAtStage: 0,
        revealsFact: 'f1',
      },
    ];
    expect(findAdvancePath(stage, { events, stageIndex: 0 })).toEqual(['pin ev1', 'respond']);
  });
```

- [ ] **Step 3: Run the tests and verify the new ones fail**

Run: `npm run test -- src/engine/reachability.test.ts`
Expected: FAIL — `findAdvancePath` takes one argument and has no `advanceWhen` handling. The original three tests still pass.

- [ ] **Step 4: Implement the extended validator**

Replace the whole of `src/engine/reachability.ts`:

```ts
import type { LogEvent, Stage } from '@/content/types';

interface ReachabilityOptions {
  events?: LogEvent[];
  stageIndex?: number;
}

interface SearchNode {
  facts: Set<string>;
  path: string[];
}

function advanceWhenSatisfied(stage: Stage, facts: ReadonlySet<string>): boolean {
  const required = stage.advanceWhen?.facts;
  if (!required || required.length === 0) return false;
  return required.every((factId) => facts.has(factId));
}

/**
 * Breadth-first search over every way a stage's facts can accumulate —
 * terminal commands and pinnable log events alike — looking for a state
 * that completes the stage. Returns the shortest such sequence, or null
 * if the stage is soft-locked.
 *
 * Path entries are command descriptions, or `pin <eventId>` for evidence.
 */
export function findAdvancePath(stage: Stage, options: ReachabilityOptions = {}): string[] | null {
  const stageIndex = options.stageIndex ?? 0;
  const pinnable = (options.events ?? []).filter(
    (event) => event.revealsFact !== undefined && event.arrivesAtStage <= stageIndex
  );

  const seen = new Set<string>(['']);
  let frontier: SearchNode[] = [{ facts: new Set(), path: [] }];

  while (frontier.length > 0) {
    // Advance one full BFS layer at a time. A stage may complete either by
    // satisfying `advanceWhen` (a win at this depth) or by running an
    // `advances` command (a win one step deeper), so every same-depth goal
    // must be checked before descending — otherwise the first expansion
    // that finds an `advances` command returns a longer path than a peer
    // node in the same layer would have.
    for (const node of frontier) {
      if (advanceWhenSatisfied(stage, node.facts)) return node.path;
    }

    const next: SearchNode[] = [];

    for (const node of frontier) {
      for (const command of stage.commands) {
        const requires = command.requiresFacts ?? [];
        if (!requires.every((factId) => node.facts.has(factId))) continue;

        const path = [...node.path, command.description];
        if (command.outcome.advances) return path;

        const nextFacts = new Set(node.facts);
        (command.outcome.revealsFacts ?? []).forEach((factId) => nextFacts.add(factId));
        const key = [...nextFacts].sort().join(',');
        if (seen.has(key)) continue;
        seen.add(key);
        next.push({ facts: nextFacts, path });
      }

      for (const event of pinnable) {
        const factId = event.revealsFact!;
        if (node.facts.has(factId)) continue;

        const nextFacts = new Set(node.facts);
        nextFacts.add(factId);
        const key = [...nextFacts].sort().join(',');
        if (seen.has(key)) continue;
        seen.add(key);
        next.push({ facts: nextFacts, path: [...node.path, `pin ${event.id}`] });
      }
    }

    frontier = next;
  }

  return null;
}
```

- [ ] **Step 5: Run the full test suite and verify everything passes**

Run: `npm run test`
Expected: PASS — including the untouched Infiltrator reachability tests, which still call `findAdvancePath(stage)` with one argument.

- [ ] **Step 6: Commit**

```bash
git add src/content/types.ts src/engine/reachability.ts src/engine/reachability.test.ts
git commit -m "feat: extend reachability validator to cover pinnable log evidence"
```

---

### Task 6: Store — Evidence Pinning, Unified Fact Reveal & advanceWhen

**Files:**
- Modify: `src/engine/store.ts`
- Test: `src/engine/store.test.ts` (add cases; keep the existing four passing)

**Interfaces:**
- Consumes: `parseCommand` (`src/engine/terminalParser.ts`); `Campaign`, `ClusterDelta`, `TerminalEntry` (`src/content/types.ts`).
- Produces: store additions `pinnedEvidence: string[]`, `activeQuery: string`, `timeRangeId: string`, `setQuery(query: string): void`, `setTimeRange(rangeId: string): void`, `pinEvent(eventId: string): void`, `unpinEvent(eventId: string): void`.

**The central refactor:** fact reveal and stage-advance evaluation currently live inline inside `runCommand`. Both move into one shared helper, `applyReveal`, so pinning and commands cannot drift apart. There must be exactly one place that decides a stage is over.

- [ ] **Step 1: Extend the test campaign and add the failing store tests**

In `src/engine/store.test.ts`, add a `logCorpus` to `testCampaign` (as a sibling of `stages`):

```ts
  logCorpus: [
    {
      id: 'ev-a',
      timestamp: '2026-08-12T02:00:00Z',
      source: 'edr',
      message: 'suspicious thing',
      fields: { pod: 'p' },
      arrivesAtStage: 0,
      revealsFact: 'seen-pod',
      analystNote: 'note a',
    },
    {
      id: 'ev-benign',
      timestamp: '2026-08-12T02:05:00Z',
      source: 'edr',
      message: 'routine thing',
      fields: { pod: 'p' },
      arrivesAtStage: 0,
      analystNote: 'nothing to see',
    },
    {
      id: 'ev-late',
      timestamp: '2026-08-12T02:06:00Z',
      source: 'edr',
      message: 'later thing',
      fields: { pod: 'p' },
      arrivesAtStage: 1,
      revealsFact: 'later-fact',
      analystNote: 'note late',
    },
  ],
```

Add a third stage to `testCampaign.stages` so a pin-driven advance has somewhere to go:

```ts
    {
      id: 'stage-3',
      title: 'Stage 3',
      briefing: [],
      objective: 'o3',
      clusterInitial: { status: 'compromised' },
      commands: [],
    },
```

And give the existing `stage-2` an `advanceWhen` by adding this property to it:

```ts
      advanceWhen: { facts: ['later-fact'] },
```

Then append these test blocks:

```ts
describe('evidence pinning', () => {
  it('reveals a fact when a signal event is pinned', () => {
    useSimStore.getState().startCampaign(testCampaign);
    useSimStore.getState().pinEvent('ev-a');
    const state = useSimStore.getState();
    expect(state.pinnedEvidence).toEqual(['ev-a']);
    expect(state.collectedFacts).toEqual(['seen-pod']);
  });

  it('pins a benign event without revealing anything or advancing', () => {
    useSimStore.getState().startCampaign(testCampaign);
    useSimStore.getState().pinEvent('ev-benign');
    const state = useSimStore.getState();
    expect(state.pinnedEvidence).toEqual(['ev-benign']);
    expect(state.collectedFacts).toEqual([]);
    expect(state.stageIndex).toBe(0);
  });

  it('ignores a pin for an event that has not arrived yet', () => {
    useSimStore.getState().startCampaign(testCampaign);
    useSimStore.getState().pinEvent('ev-late');
    expect(useSimStore.getState().pinnedEvidence).toEqual([]);
  });

  it('does not double-pin the same event', () => {
    useSimStore.getState().startCampaign(testCampaign);
    useSimStore.getState().pinEvent('ev-a');
    useSimStore.getState().pinEvent('ev-a');
    expect(useSimStore.getState().pinnedEvidence).toEqual(['ev-a']);
  });

  it('unpins an event without retracting the fact it established', () => {
    useSimStore.getState().startCampaign(testCampaign);
    useSimStore.getState().pinEvent('ev-a');
    useSimStore.getState().unpinEvent('ev-a');
    const state = useSimStore.getState();
    expect(state.pinnedEvidence).toEqual([]);
    expect(state.collectedFacts).toEqual(['seen-pod']);
  });

  it('advances the stage when a pin satisfies advanceWhen', () => {
    useSimStore.getState().startCampaign(testCampaign);
    useSimStore.getState().runCommand('look');
    useSimStore.getState().runCommand('act');
    expect(useSimStore.getState().stageIndex).toBe(1);
    // 'ev-late' has now arrived (arrivesAtStage 1) and reveals the fact
    // stage-2's advanceWhen requires.
    useSimStore.getState().pinEvent('ev-late');
    expect(useSimStore.getState().stageIndex).toBe(2);
  });
});

describe('query state', () => {
  it('stores the active query and time range', () => {
    useSimStore.getState().startCampaign(testCampaign);
    useSimStore.getState().setQuery('source=edr');
    useSimStore.getState().setTimeRange('all-time');
    const state = useSimStore.getState();
    expect(state.activeQuery).toBe('source=edr');
    expect(state.timeRangeId).toBe('all-time');
  });

  it('clears query and pinned evidence when a campaign starts', () => {
    useSimStore.getState().startCampaign(testCampaign);
    useSimStore.getState().setQuery('source=edr');
    useSimStore.getState().pinEvent('ev-a');
    useSimStore.getState().startCampaign(testCampaign);
    const state = useSimStore.getState();
    expect(state.activeQuery).toBe('');
    expect(state.pinnedEvidence).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the tests and verify they fail**

Run: `npm run test -- src/engine/store.test.ts`
Expected: FAIL — `pinEvent is not a function`.

- [ ] **Step 3: Rewrite `src/engine/store.ts`**

```ts
import { useState, useEffect } from 'react';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { parseCommand } from './terminalParser';
import type { Campaign, CampaignId, ClusterDelta, TerminalEntry } from '@/content/types';

type ClusterStatus = 'nominal' | 'suspicious' | 'compromised' | 'contained';

interface SimState {
  campaign: Campaign | null;
  campaignId: CampaignId | null;
  stageIndex: number;
  revealedFacts: string[];
  collectedFacts: string[];
  terminalHistory: TerminalEntry[];
  clusterStatus: ClusterStatus;
  highlightedNodeIds: string[];
  revealedEdgeIds: string[];
  pinnedEvidence: string[];
  activeQuery: string;
  timeRangeId: string;
  startCampaign: (campaign: Campaign) => void;
  hydrateCampaign: (campaign: Campaign) => void;
  runCommand: (input: string) => void;
  pinEvent: (eventId: string) => void;
  unpinEvent: (eventId: string) => void;
  setQuery: (query: string) => void;
  setTimeRange: (rangeId: string) => void;
  resetProgress: () => void;
}

const initialTransientState = {
  stageIndex: 0,
  revealedFacts: [] as string[],
  collectedFacts: [] as string[],
  terminalHistory: [] as TerminalEntry[],
  clusterStatus: 'nominal' as ClusterStatus,
  highlightedNodeIds: [] as string[],
  revealedEdgeIds: [] as string[],
  pinnedEvidence: [] as string[],
  activeQuery: '',
  timeRangeId: 'last-1h',
};

/**
 * The cluster-visual patch applied at campaign start, where resolving
 * absent id arrays to `[]` is correct because nothing has accumulated yet.
 * Stage advance does NOT use this — see the three-level fallback below.
 */
function enterStagePatch(delta: ClusterDelta | undefined, fallback: ClusterStatus) {
  return {
    clusterStatus: delta?.status ?? fallback,
    highlightedNodeIds: delta?.highlightNodeIds ?? [],
    revealedEdgeIds: delta?.revealEdgeIds ?? [],
  };
}

export const useSimStore = create<SimState>()(
  persist(
    (set, get) => {
      /**
       * The single place facts are added and stage completion is judged.
       * Both the terminal and evidence pinning route through here, so the
       * two surfaces can never disagree about when a stage is over.
       */
      function applyReveal(
        factIds: string[],
        extra: Partial<SimState>,
        forceAdvance: boolean,
        delta?: ClusterDelta
      ): void {
        const state = get();
        const { campaign, stageIndex } = state;
        if (!campaign) return;

        const collectedFacts = [...new Set([...state.collectedFacts, ...factIds])];
        const revealedFacts = [...new Set([...state.revealedFacts, ...factIds])];

        const stage = campaign.stages[stageIndex];
        const required = stage?.advanceWhen?.facts ?? [];
        const advanceWhenMet =
          required.length > 0 && required.every((factId) => collectedFacts.includes(factId));

        if (forceAdvance || advanceWhenMet) {
          const nextStage = campaign.stages[stageIndex + 1];
          set({
            ...extra,
            collectedFacts,
            revealedFacts: [],
            stageIndex: stageIndex + 1,
            // Three-level fallback, preserved from the pre-refactor store:
            // next stage's own value, else the command's delta, else what
            // has accumulated. Resolving to [] here would wipe the diagram
            // whenever a stage declares a status but no ids — which the
            // Infiltrator `exploit -> escalation` transition does.
            clusterStatus:
              nextStage?.clusterInitial.status ?? delta?.status ?? state.clusterStatus,
            highlightedNodeIds:
              nextStage?.clusterInitial.highlightNodeIds ??
              delta?.highlightNodeIds ??
              state.highlightedNodeIds,
            revealedEdgeIds:
              nextStage?.clusterInitial.revealEdgeIds ??
              delta?.revealEdgeIds ??
              state.revealedEdgeIds,
          });
          return;
        }

        set({
          ...extra,
          collectedFacts,
          revealedFacts,
          clusterStatus: delta?.status ?? state.clusterStatus,
          highlightedNodeIds: delta?.highlightNodeIds
            ? [...new Set([...state.highlightedNodeIds, ...delta.highlightNodeIds])]
            : state.highlightedNodeIds,
          revealedEdgeIds: delta?.revealEdgeIds
            ? [...new Set([...state.revealedEdgeIds, ...delta.revealEdgeIds])]
            : state.revealedEdgeIds,
        });
      }

      return {
        campaign: null,
        campaignId: null,
        ...initialTransientState,

        startCampaign: (campaign) => {
          const firstStage = campaign.stages[0];
          set({
            campaign,
            campaignId: campaign.id,
            ...initialTransientState,
            ...enterStagePatch(firstStage.clusterInitial, 'nominal'),
          });
        },

        hydrateCampaign: (campaign) => set({ campaign }),

        runCommand: (input) => {
          const state = get();
          if (!state.campaign) return;
          const stage = state.campaign.stages[state.stageIndex];
          const outcome = parseCommand(input, stage, new Set(state.revealedFacts));

          if (!outcome) {
            set({
              terminalHistory: [
                ...state.terminalHistory,
                { input, output: ['Command not recognized in this context.'] },
              ],
            });
            return;
          }

          applyReveal(
            outcome.revealsFacts ?? [],
            { terminalHistory: [...state.terminalHistory, { input, output: outcome.output }] },
            outcome.advances === true,
            outcome.clusterDelta
          );
        },

        pinEvent: (eventId) => {
          const state = get();
          const event = state.campaign?.logCorpus?.find((candidate) => candidate.id === eventId);
          if (!event) return;
          if (event.arrivesAtStage > state.stageIndex) return;
          if (state.pinnedEvidence.includes(eventId)) return;

          applyReveal(
            event.revealsFact ? [event.revealsFact] : [],
            { pinnedEvidence: [...state.pinnedEvidence, eventId] },
            false,
            undefined
          );
        },

        /**
         * Unpinning removes the card from the case file but never retracts
         * an established fact — you cannot un-know that the shell ran.
         */
        unpinEvent: (eventId) =>
          set({
            pinnedEvidence: get().pinnedEvidence.filter((pinned) => pinned !== eventId),
          }),

        setQuery: (query) => set({ activeQuery: query }),

        setTimeRange: (rangeId) => set({ timeRangeId: rangeId }),

        resetProgress: () => set({ campaign: null, campaignId: null, ...initialTransientState }),
      };
    },
    {
      name: 'operation-mango-progress',
      partialize: (state) => ({
        campaignId: state.campaignId,
        stageIndex: state.stageIndex,
        revealedFacts: state.revealedFacts,
        collectedFacts: state.collectedFacts,
        terminalHistory: state.terminalHistory,
        clusterStatus: state.clusterStatus,
        highlightedNodeIds: state.highlightedNodeIds,
        revealedEdgeIds: state.revealedEdgeIds,
        pinnedEvidence: state.pinnedEvidence,
        activeQuery: state.activeQuery,
        timeRangeId: state.timeRangeId,
      }),
    }
  )
);

export function useHasHydrated(): boolean {
  // `persist` is only attached to the store API once its storage backend
  // (localStorage) is successfully accessed. During `next build`'s static
  // export prerendering (Node, no `window`/`localStorage`), that access
  // throws and `useSimStore.persist` stays undefined — guard against that
  // so the build doesn't crash; in a real browser this is always defined.
  const [hasHydrated, setHasHydrated] = useState(
    () => useSimStore.persist?.hasHydrated() ?? false
  );

  useEffect(() => {
    setHasHydrated(useSimStore.persist?.hasHydrated() ?? false);
    const unsubscribe = useSimStore.persist?.onFinishHydration(() => setHasHydrated(true));
    return unsubscribe;
  }, []);

  return hasHydrated;
}
```

- [ ] **Step 4: Run the full suite and verify it passes**

Run: `npm run test`
Expected: PASS — the four original store tests plus the eight new ones, with the Infiltrator content tests unchanged.

- [ ] **Step 5: Commit**

```bash
git add src/engine/store.ts src/engine/store.test.ts
git commit -m "feat: add evidence pinning and unify fact reveal in the progress store"
```

---

### Task 7: Reworked Sentinel Campaign Content

**Files:**
- Modify: `src/content/types.ts` (add `detection` to `CampaignDebrief`)
- Rewrite: `src/content/chapter1/sentinel.ts`
- Rewrite: `src/content/chapter1/sentinel.reachability.test.ts`
- Modify: `src/content/chapter1/attackMap.test.ts` (add the fact-library cross-check deferred from Task 4)

**Interfaces:**
- Consumes: `Campaign` (`src/content/types.ts`); `sentinelLogCorpus`, `TIME_RANGES` (`./logs`); `sentinelAttackMap` (`./attackMap`); `findAdvancePath` (`@/engine/reachability`).
- Produces: `sentinelCampaign: Campaign` — now carrying `logCorpus`, `attackMap`, and `timeRanges`.

**Design intent to preserve:** Stages 1–4 have **no terminal commands at all** (`commands: []`). The mission workspace hides the terminal until a stage has commands, so the response console appearing in Stage 5 is a deliberate beat. Stage 4 must be reachable only *before* containment — do not add response commands to earlier stages as a convenience.

- [ ] **Step 1: Add the detection section to `CampaignDebrief` in `src/content/types.ts`**

Replace the existing `CampaignDebrief` interface with:

```ts
export interface CampaignDebrief {
  narrative: string[];
  lesson: string;
  /** Plain-language detection guidance, shown only when present. */
  detection?: string[];
  nextChapterTeaser: string;
}
```

- [ ] **Step 2: Write the failing Sentinel reachability test**

Replace the whole of `src/content/chapter1/sentinel.reachability.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { findAdvancePath } from '@/engine/reachability';
import { sentinelCampaign } from './sentinel';

describe('sentinelCampaign', () => {
  it('has a reachable advance path in every stage', () => {
    sentinelCampaign.stages.forEach((stage, stageIndex) => {
      const path = findAdvancePath(stage, {
        events: sentinelCampaign.logCorpus,
        stageIndex,
      });
      expect(path, `stage "${stage.id}" has no reachable advance path`).not.toBeNull();
    });
  });

  it('has a factLibrary entry for every fact referenced by any command', () => {
    const referenced = new Set<string>();
    for (const stage of sentinelCampaign.stages) {
      for (const command of stage.commands) {
        (command.outcome.revealsFacts ?? []).forEach((factId) => referenced.add(factId));
        (command.requiresFacts ?? []).forEach((factId) => referenced.add(factId));
      }
      (stage.advanceWhen?.facts ?? []).forEach((factId) => referenced.add(factId));
    }
    for (const factId of referenced) {
      expect(
        sentinelCampaign.factLibrary[factId],
        `missing factLibrary entry for "${factId}"`
      ).toBeDefined();
    }
  });

  it('has a factLibrary entry for every fact revealed by a log event', () => {
    for (const event of sentinelCampaign.logCorpus ?? []) {
      if (!event.revealsFact) continue;
      expect(
        sentinelCampaign.factLibrary[event.revealsFact],
        `event "${event.id}" reveals unknown fact "${event.revealsFact}"`
      ).toBeDefined();
    }
  });

  it('investigates in the SIEM and responds in the terminal', () => {
    const withCommands = sentinelCampaign.stages.filter((stage) => stage.commands.length > 0);
    expect(withCommands.map((stage) => stage.id)).toEqual(['containment']);
  });

  it('gives every SIEM stage suggested queries and a hint', () => {
    for (const stage of sentinelCampaign.stages) {
      if (stage.commands.length > 0) continue;
      expect(stage.suggestedQueries?.length, `stage "${stage.id}" has no suggestions`).toBeGreaterThan(0);
      expect(stage.hint, `stage "${stage.id}" has no hint`).toBeTruthy();
    }
  });

  it('carries its log corpus, attack map, and time ranges', () => {
    expect(sentinelCampaign.logCorpus?.length).toBeGreaterThan(100);
    expect(sentinelCampaign.attackMap?.length).toBeGreaterThan(0);
    expect(sentinelCampaign.timeRanges?.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 3: Run the test and verify it fails**

Run: `npm run test -- src/content/chapter1/sentinel.reachability.test.ts`
Expected: FAIL — the current `sentinelCampaign` has terminal commands in every stage and no `logCorpus`.

- [ ] **Step 4: Rewrite the Sentinel campaign**

Replace the whole of `src/content/chapter1/sentinel.ts`:

```ts
import type { Campaign } from '../types';
import { sentinelAttackMap } from './attackMap';
import { sentinelLogCorpus, TIME_RANGES } from './logs';

const IMPLANT_POD = 'ci-deploy-bot-7f9c4d6b6-x2k1p';

export const sentinelCampaign: Campaign = {
  id: 'sentinel',
  title: 'The Sentinel',
  tagline: "You're MangoCorp security, first on the scene of a live incident.",
  logCorpus: sentinelLogCorpus,
  attackMap: sentinelAttackMap,
  timeRanges: TIME_RANGES,
  factLibrary: {
    'evidence-interactive-shell': {
      id: 'evidence-interactive-shell',
      label: 'Interactive shell in a build pod',
      detail:
        'EDR caught /bin/sh running inside ci-deploy-bot under the build agent. CI jobs are scripted and non-interactive — this was a person.',
    },
    'evidence-offhours-exec': {
      id: 'evidence-offhours-exec',
      label: 'Off-hours exec from an external IP',
      detail:
        'The audit log shows create pods/exec at 02:14 UTC from 203.0.113.44, using the ci-deploy-bot service account. No pipeline runs in that window.',
    },
    'evidence-sa-identity': {
      id: 'evidence-sa-identity',
      label: 'Build account acting cluster-wide',
      detail:
        'ci-deploy-bot listed secrets across every namespace — far outside anything a build job needs.',
    },
    'evidence-clusteradmin-binding': {
      id: 'evidence-clusteradmin-binding',
      label: 'Bound to cluster-admin',
      detail:
        'The authorizer named ci-deploy-bot-binding as the rule that allowed it: a direct binding to the built-in cluster-admin ClusterRole.',
    },
    'evidence-binding-origin': {
      id: 'evidence-binding-origin',
      label: 'Binding predates the breach by 14 months',
      detail:
        'ci-deploy-bot-binding was created on 2025-06-14 by the jenkins-migration-2024 script and never revisited.',
    },
    'evidence-secret-read': {
      id: 'evidence-secret-read',
      label: 'Cultivar genome secret read',
      detail:
        'A successful get on secrets/ultra-mango-genome-db in the product namespace at 02:15:12, by the build service account.',
    },
    'evidence-exfil-egress': {
      id: 'evidence-exfil-egress',
      label: 'Data left the cluster',
      detail:
        '2.8 MB egressed from the build pod to 203.0.113.44 at 02:16:40 — the same address that opened the shell.',
    },
    'evidence-rogue-sa': {
      id: 'evidence-rogue-sa',
      label: 'Rogue service account planted',
      detail:
        "A service account named 'log-rotator' was created in kube-system at 02:31:07 to look like routine maintenance.",
    },
    'evidence-rogue-binding': {
      id: 'evidence-rogue-binding',
      label: 'Second cluster-admin binding',
      detail:
        'log-rotator-admin binds the planted account to cluster-admin — a way back in that survives revoking ci-deploy-bot.',
    },
    'revoked-primary-binding': {
      id: 'revoked-primary-binding',
      label: 'Primary binding revoked',
      detail: 'ci-deploy-bot-binding is deleted. The build account is no longer cluster-admin.',
    },
    'revoked-persistence-binding': {
      id: 'revoked-persistence-binding',
      label: 'Persistence binding revoked',
      detail: 'log-rotator-admin is deleted. The attacker-created path to cluster-admin is closed.',
    },
    'removed-rogue-sa': {
      id: 'removed-rogue-sa',
      label: 'Rogue account removed',
      detail: 'The log-rotator service account no longer exists in kube-system.',
    },
    'removed-implant-pod': {
      id: 'removed-implant-pod',
      label: 'Implant pod removed',
      detail:
        'The compromised ci-deploy-bot pod is gone. Its replacement comes from the same image, so the pipeline still needs fixing.',
    },
    'rotated-secret': {
      id: 'rotated-secret',
      label: 'Exposed secret rotated',
      detail:
        'ultra-mango-genome-db has been re-issued. The copy the attacker took no longer opens anything.',
    },
  },
  stages: [
    {
      id: 'triage',
      title: 'Triage',
      briefing: [
        "Ticket #4471, auto-raised 12 minutes ago: 'Anomalous process activity in a build-namespace container.'",
        'Overnight tickets are usually a flaky job or a bad deploy. You open the log console to rule it out.',
      ],
      objective: 'Confirm the alert is real and identify the workload behind it.',
      clusterInitial: { status: 'nominal' },
      advanceWhen: { facts: ['evidence-interactive-shell', 'evidence-offhours-exec'] },
      suggestedQueries: [
        { label: 'High-severity endpoint alerts', query: 'source=edr severity=high' },
        { label: 'Exec calls in the audit log', query: 'source=k8s-audit resource=pods/exec' },
      ],
      hint: 'The alert came from a container, so start in the endpoint data: source=edr, then narrow by severity. Once you have a pod name, confirm it against the audit log — two sources agreeing is what turns a hunch into a finding.',
      commands: [],
    },
    {
      id: 'identity',
      title: 'Identity & Blast Radius',
      briefing: [
        "You: Someone opened a shell in a build pod at two in the morning. That's real.",
        'You: Before anything else — what identity were they using, and what does that identity let them touch?',
      ],
      objective: 'Establish which account the activity ran as, and how much access it had.',
      clusterInitial: { status: 'suspicious' },
      advanceWhen: {
        facts: ['evidence-sa-identity', 'evidence-clusteradmin-binding', 'evidence-binding-origin'],
      },
      suggestedQueries: [
        { label: 'Everything from this account', query: 'user=ci-deploy-bot' },
        { label: 'Authorization decisions', query: 'source=apiserver decision=allow' },
        { label: 'ClusterRoleBinding changes', query: 'resource=clusterrolebindings' },
      ],
      hint: 'Searching the account name alone returns a lot of perfectly normal build traffic — the name is not the anomaly, the scope is. And the binding that granted this access was not created during the breach: widen the time range to All time to find when it appeared.',
      commands: [],
    },
    {
      id: 'scope',
      title: 'Scope the Damage',
      briefing: [
        'You: A build account with cluster-admin. Fourteen months old.',
        'You: Containment can wait ninety seconds. First — what did they actually reach?',
      ],
      objective: 'Determine what was accessed, and whether it left the cluster.',
      clusterInitial: { status: 'suspicious' },
      advanceWhen: { facts: ['evidence-secret-read', 'evidence-exfil-egress'] },
      suggestedQueries: [
        { label: 'Secret access', query: 'source=k8s-audit resource=secrets' },
        { label: 'Outbound connections', query: 'source=edr remoteIP=203.0.113.44' },
      ],
      hint: 'Reading a secret and stealing it are two different claims, proven by two different sources. The audit log shows the read; only the endpoint egress record shows the data leaving.',
      commands: [],
    },
    {
      id: 'persistence',
      title: 'Hunt Persistence',
      briefing: [
        'You: The genome data is gone. Every instinct says cut the account off right now.',
        'You: But they had cluster-admin for seventeen minutes. If they made themselves a second way in and you revoke only the first, you have not evicted anyone — you have told them you are awake.',
      ],
      objective: 'Find what the attacker created before you close anything down.',
      clusterInitial: { status: 'compromised' },
      advanceWhen: { facts: ['evidence-rogue-sa', 'evidence-rogue-binding'] },
      suggestedQueries: [
        {
          label: 'Creations in kube-system',
          query: 'source=k8s-audit verb=create namespace=kube-system',
        },
        { label: 'New bindings', query: 'resource=clusterrolebindings verb=create' },
      ],
      hint: 'Ask what an attacker with cluster-admin would make with it. New identities and new bindings both leave create records in the audit log — look in kube-system, where a maintenance-sounding name would not get a second glance.',
      commands: [],
    },
    {
      id: 'containment',
      title: 'Contain & Eradicate',
      briefing: [
        'You: Two paths to cluster-admin, one of them theirs. Now you can move.',
        'Response console unlocked. Order matters: take the bindings before the accounts, or you are deleting an account that can still recreate itself.',
      ],
      objective: 'Revoke both privilege paths, remove what they planted, and rotate what leaked.',
      clusterInitial: { status: 'compromised' },
      commands: [
        {
          match: /^kubectl\s+delete\s+clusterrolebinding\s+ci-deploy-bot-binding$/i,
          description: 'kubectl delete clusterrolebinding ci-deploy-bot-binding',
          outcome: {
            output: [
              'clusterrolebinding.rbac.authorization.k8s.io "ci-deploy-bot-binding" deleted',
              'ci-deploy-bot drops to its default, near-zero permissions.',
            ],
            revealsFacts: ['revoked-primary-binding'],
          },
        },
        {
          match: /^kubectl\s+delete\s+clusterrolebinding\s+log-rotator-admin$/i,
          description: 'kubectl delete clusterrolebinding log-rotator-admin',
          requiresFacts: ['revoked-primary-binding'],
          outcome: {
            output: [
              'clusterrolebinding.rbac.authorization.k8s.io "log-rotator-admin" deleted',
              'The path you would have missed is closed.',
            ],
            revealsFacts: ['revoked-persistence-binding'],
          },
        },
        {
          match: /^kubectl\s+delete\s+serviceaccount\s+log-rotator\s+-n\s+kube-system$/i,
          description: 'kubectl delete serviceaccount log-rotator -n kube-system',
          requiresFacts: ['revoked-persistence-binding'],
          outcome: {
            output: [
              'serviceaccount "log-rotator" deleted',
              'The planted identity is gone, and it was powerless the moment its binding went.',
            ],
            revealsFacts: ['removed-rogue-sa'],
          },
        },
        {
          match: new RegExp(`^kubectl\\s+delete\\s+pod\\s+${IMPLANT_POD}\\s+-n\\s+build$`, 'i'),
          description: `kubectl delete pod ${IMPLANT_POD} -n build`,
          requiresFacts: ['removed-rogue-sa'],
          outcome: {
            output: [
              `pod "${IMPLANT_POD}" deleted`,
              'The deployment schedules a replacement — from the same image. You have evicted the session, not the implant.',
            ],
            revealsFacts: ['removed-implant-pod'],
          },
        },
        {
          match: /^kubectl\s+delete\s+secret\s+ultra-mango-genome-db\s+-n\s+product$/i,
          description: 'kubectl delete secret ultra-mango-genome-db -n product',
          requiresFacts: ['removed-implant-pod'],
          outcome: {
            output: [
              'secret "ultra-mango-genome-db" deleted',
              'The secrets operator re-issues it with fresh material within the minute.',
              'The copy Citrus Dynamics took is now inert.',
              '-- INCIDENT CONTAINED --',
            ],
            revealsFacts: ['rotated-secret'],
            advances: true,
            clusterDelta: { status: 'contained', highlightNodeIds: [], revealEdgeIds: [] },
          },
        },
      ],
    },
  ],
  debrief: {
    narrative: [
      'By 03:40 the bindings are gone, the planted account is gone, and the genome secret has been re-issued. The pod that started it all has been replaced by an identical one, pulled from the same image — which is the part that should keep you up at night.',
      'Citrus Dynamics still has a copy of what was taken at 02:16. Containment does not undo exfiltration; it only decides how much more there would have been.',
      'What you did buy was the truth: how they got in, how far it reached, and what they left behind.',
    ],
    lesson:
      'The breach was made possible by a CI/CD service account bound directly to the built-in cluster-admin ClusterRole — a shortcut taken during a pipeline migration fourteen months earlier and never revisited. Least-privilege RBAC would have confined a compromised build pod to the build namespace instead of the whole cluster. The investigation itself turned on two habits: corroborating a finding across independent sources (endpoint telemetry proved the shell, the audit log proved the exec), and hunting persistence before containing, because an attacker with cluster-admin creates their own way back in.',
    detection: [
      'Alert on create pods/exec against production namespaces — legitimate automation rarely execs into running pods, and attackers almost always do.',
      'Alert on any ClusterRoleBinding referencing cluster-admin at creation time, and review existing ones on a schedule so migration-era bindings surface before an incident does.',
      'Alert on ServiceAccount or ClusterRoleBinding creation in kube-system; a maintenance-sounding name is exactly what persistence looks like.',
      'Alert when a namespace-scoped service account reads secrets outside its own namespace — the field to key on is the identity, not the resource.',
      'Retain audit logs long enough to answer "when was this created?" A fourteen-month-old binding is invisible to a thirty-day retention window.',
    ],
    nextChapterTeaser:
      'The replacement pod came from the same image. Next: the supply-chain compromise that put the implant there — and the admission controls that would have stopped it at the gate.',
  },
};
```

- [ ] **Step 5: Run the Sentinel test and verify it passes**

Run: `npm run test -- src/content/chapter1/sentinel.reachability.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 6: Add the deferred attack-map cross-check**

In `src/content/chapter1/attackMap.test.ts`, add this import:

```ts
import { sentinelCampaign } from './sentinel';
```

and add this case inside `describe('sentinelAttackMap', ...)`:

```ts
  it('references only facts that exist in the campaign fact library', () => {
    for (const node of sentinelAttackMap) {
      const referenced = [
        ...node.suspectedByFacts,
        ...node.confirmedByFacts,
        ...node.containedByFacts,
      ];
      for (const factId of referenced) {
        expect(
          sentinelCampaign.factLibrary[factId],
          `node "${node.id}" references unknown fact "${factId}"`
        ).toBeDefined();
      }
    }
  });
```

- [ ] **Step 7: Run the full suite and verify it passes**

Run: `npm run test`
Expected: PASS — every suite, including the untouched Infiltrator content tests.

- [ ] **Step 8: Commit**

```bash
git add src/content/types.ts src/content/chapter1/sentinel.ts src/content/chapter1/sentinel.reachability.test.ts src/content/chapter1/attackMap.test.ts
git commit -m "feat: rework Sentinel campaign around SIEM investigation and evidence pinning"
```

---

### Task 8: Search Bar, Time Range & Query Chips

**Files:**
- Create: `src/components/LogExplorer/SearchBar.tsx`
- Create: `src/components/LogExplorer/TimeRangeSelect.tsx`
- Create: `src/components/LogExplorer/QueryChips.tsx`
- Test: `src/components/LogExplorer/SearchBar.test.tsx`
- Test: `src/components/LogExplorer/QueryChips.test.tsx`

**Interfaces:**
- Consumes: `TimeRange`, `QuerySuggestion` (`src/content/types.ts`); `cn` (`@/lib/cn`).
- Produces: `SearchBar`, `TimeRangeSelect`, `QueryChips` components with the props below.

```ts
interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  error?: string | null;
  resultCount?: number;
}

interface TimeRangeSelectProps {
  ranges: TimeRange[];
  value: string;
  onChange: (rangeId: string) => void;
}

interface QueryChipsProps {
  suggestions: QuerySuggestion[];
  onSelect: (query: string) => void;
}
```

- [ ] **Step 1: Write the failing component tests**

`src/components/LogExplorer/SearchBar.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SearchBar } from './SearchBar';

describe('SearchBar', () => {
  it('shows the current query value', () => {
    render(<SearchBar value="source=edr" onChange={() => {}} onSubmit={() => {}} />);
    expect(screen.getByLabelText('search query')).toHaveValue('source=edr');
  });

  it('reports typing through onChange', () => {
    const onChange = vi.fn();
    render(<SearchBar value="" onChange={onChange} onSubmit={() => {}} />);
    fireEvent.change(screen.getByLabelText('search query'), { target: { value: 'verb=get' } });
    expect(onChange).toHaveBeenCalledWith('verb=get');
  });

  it('submits on form submission', () => {
    const onSubmit = vi.fn();
    render(<SearchBar value="verb=get" onChange={() => {}} onSubmit={onSubmit} />);
    fireEvent.submit(screen.getByRole('search'));
    expect(onSubmit).toHaveBeenCalled();
  });

  it('shows a parse error when one is supplied', () => {
    render(
      <SearchBar value="user=" onChange={() => {}} onSubmit={() => {}} error='Missing value for field "user".' />
    );
    expect(screen.getByRole('alert')).toHaveTextContent('Missing value for field "user".');
  });

  it('shows the result count when there is no error', () => {
    render(<SearchBar value="" onChange={() => {}} onSubmit={() => {}} resultCount={42} />);
    expect(screen.getByTestId('result-count')).toHaveTextContent('42 events');
  });

  it('hides the result count when there is an error', () => {
    render(
      <SearchBar value="" onChange={() => {}} onSubmit={() => {}} resultCount={42} error="bad" />
    );
    expect(screen.queryByTestId('result-count')).toBeNull();
  });
});
```

`src/components/LogExplorer/QueryChips.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryChips } from './QueryChips';

const suggestions = [
  { label: 'High-severity endpoint alerts', query: 'source=edr severity=high' },
  { label: 'Exec calls', query: 'source=k8s-audit resource=pods/exec' },
];

describe('QueryChips', () => {
  it('renders a chip per suggestion', () => {
    render(<QueryChips suggestions={suggestions} onSelect={() => {}} />);
    expect(screen.getAllByRole('button')).toHaveLength(2);
  });

  it('shows the query syntax each chip will insert', () => {
    render(<QueryChips suggestions={suggestions} onSelect={() => {}} />);
    expect(screen.getByText('source=edr severity=high')).toBeInTheDocument();
  });

  it('passes the query up when a chip is clicked', () => {
    const onSelect = vi.fn();
    render(<QueryChips suggestions={suggestions} onSelect={onSelect} />);
    fireEvent.click(screen.getByRole('button', { name: /High-severity/ }));
    expect(onSelect).toHaveBeenCalledWith('source=edr severity=high');
  });

  it('renders nothing when there are no suggestions', () => {
    const { container } = render(<QueryChips suggestions={[]} onSelect={() => {}} />);
    expect(container).toBeEmptyDOMElement();
  });
});
```

- [ ] **Step 2: Run the tests and verify they fail**

Run: `npm run test -- src/components/LogExplorer`
Expected: FAIL — cannot find module `./SearchBar`.

- [ ] **Step 3: Implement `SearchBar`**

`src/components/LogExplorer/SearchBar.tsx`:

```tsx
'use client';

import type { FormEvent } from 'react';

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  error?: string | null;
  resultCount?: number;
}

export function SearchBar({ value, onChange, onSubmit, error, resultCount }: SearchBarProps) {
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSubmit();
  }

  return (
    <form role="search" onSubmit={handleSubmit} className="flex flex-col gap-2">
      <div className="flex items-center gap-2 rounded border border-mango-500/30 bg-black/50 px-3 py-2">
        <span aria-hidden="true" className="font-mono text-mango-500">
          &gt;
        </span>
        <input
          aria-label="search query"
          className="flex-1 bg-transparent font-mono text-sm text-mango-100 outline-none placeholder:text-mango-300/30"
          placeholder="source=k8s-audit user=ci-deploy-bot"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          autoComplete="off"
          spellCheck={false}
        />
        <button
          type="submit"
          className="rounded bg-mango-500/20 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-mango-300 hover:bg-mango-500/30"
        >
          Search
        </button>
      </div>

      {error ? (
        <p role="alert" className="font-mono text-xs text-blight-400">
          {error}
        </p>
      ) : (
        resultCount !== undefined && (
          <p data-testid="result-count" className="font-mono text-xs text-mango-300/60">
            {resultCount} events
          </p>
        )
      )}
    </form>
  );
}
```

- [ ] **Step 4: Implement `TimeRangeSelect`**

`src/components/LogExplorer/TimeRangeSelect.tsx`:

```tsx
'use client';

import type { TimeRange } from '@/content/types';

interface TimeRangeSelectProps {
  ranges: TimeRange[];
  value: string;
  onChange: (rangeId: string) => void;
}

export function TimeRangeSelect({ ranges, value, onChange }: TimeRangeSelectProps) {
  return (
    <label className="flex items-center gap-2 text-xs uppercase tracking-wider text-mango-300/60">
      Time range
      <select
        aria-label="time range"
        className="rounded border border-mango-500/30 bg-black/50 px-2 py-1 font-mono text-xs text-mango-100 outline-none"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        {ranges.map((range) => (
          <option key={range.id} value={range.id}>
            {range.label}
          </option>
        ))}
      </select>
    </label>
  );
}
```

- [ ] **Step 5: Implement `QueryChips`**

`src/components/LogExplorer/QueryChips.tsx`:

```tsx
'use client';

import type { QuerySuggestion } from '@/content/types';

interface QueryChipsProps {
  suggestions: QuerySuggestion[];
  onSelect: (query: string) => void;
}

/**
 * Chips show the syntax they insert, not just a friendly label — the
 * point is that the player learns the query language by watching it
 * appear in the bar, then editing it.
 */
export function QueryChips({ suggestions, onSelect }: QueryChipsProps) {
  if (suggestions.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {suggestions.map((suggestion) => (
        <button
          key={suggestion.query}
          type="button"
          onClick={() => onSelect(suggestion.query)}
          className="group rounded border border-mango-500/25 bg-mango-900/40 px-3 py-1.5 text-left hover:border-mango-500/60"
        >
          <span className="block text-xs text-mango-300">{suggestion.label}</span>
          <span className="block font-mono text-[11px] text-mango-500/70">{suggestion.query}</span>
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 6: Run the tests and verify they pass**

Run: `npm run test -- src/components/LogExplorer`
Expected: PASS (10 tests).

- [ ] **Step 7: Commit**

```bash
git add src/components/LogExplorer/SearchBar.tsx src/components/LogExplorer/TimeRangeSelect.tsx src/components/LogExplorer/QueryChips.tsx src/components/LogExplorer/SearchBar.test.tsx src/components/LogExplorer/QueryChips.test.tsx
git commit -m "feat: add log explorer search bar, time range select, and query chips"
```

---

### Task 9: Results Table, Event Detail & Histogram

**Files:**
- Create: `src/components/LogExplorer/ResultsTable.tsx`
- Create: `src/components/LogExplorer/EventDetail.tsx`
- Create: `src/components/LogExplorer/Histogram.tsx`
- Test: `src/components/LogExplorer/ResultsTable.test.tsx`
- Test: `src/components/LogExplorer/EventDetail.test.tsx`

**Interfaces:**
- Consumes: `LogEvent`, `TimeRange`; `cn` (`@/lib/cn`).
- Produces:

```ts
interface ResultsTableProps {
  events: LogEvent[];
  selectedId: string | null;
  pinnedIds: string[];
  onSelect: (eventId: string) => void;
}

interface EventDetailProps {
  event: LogEvent | null;
  isPinned: boolean;
  onPin: (eventId: string) => void;
  onUnpin: (eventId: string) => void;
}

interface HistogramProps {
  events: LogEvent[];
  range: TimeRange;
}
```

**Note on the pin button's copy:** it must never say "correct" or "wrong". The button reads "Pin to case file"; the consequence of pinning appears as the analyst note. Whether an event mattered is something the player judges from the note, not something the UI grades.

- [ ] **Step 1: Write the failing tests**

`src/components/LogExplorer/ResultsTable.test.tsx`:

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

describe('ResultsTable', () => {
  it('renders a row per event', () => {
    render(<ResultsTable events={events} selectedId={null} pinnedIds={[]} onSelect={() => {}} />);
    expect(screen.getByText('Interactive shell spawned')).toBeInTheDocument();
    expect(screen.getByText('get configmaps')).toBeInTheDocument();
  });

  it('shows each event source', () => {
    render(<ResultsTable events={events} selectedId={null} pinnedIds={[]} onSelect={() => {}} />);
    expect(screen.getByText('edr')).toBeInTheDocument();
  });

  it('selects an event when its row button is activated', () => {
    const onSelect = vi.fn();
    render(<ResultsTable events={events} selectedId={null} pinnedIds={[]} onSelect={onSelect} />);
    fireEvent.click(screen.getByRole('button', { name: /Interactive shell spawned/ }));
    expect(onSelect).toHaveBeenCalledWith('e1');
  });

  it('marks the selected row', () => {
    render(<ResultsTable events={events} selectedId="e1" pinnedIds={[]} onSelect={() => {}} />);
    expect(screen.getByTestId('row-e1')).toHaveAttribute('data-selected', 'true');
  });

  it('marks pinned rows', () => {
    render(<ResultsTable events={events} selectedId={null} pinnedIds={['e2']} onSelect={() => {}} />);
    expect(screen.getByTestId('row-e2')).toHaveAttribute('data-pinned', 'true');
  });

  it('tells the player when nothing matched', () => {
    render(<ResultsTable events={[]} selectedId={null} pinnedIds={[]} onSelect={() => {}} />);
    expect(screen.getByTestId('empty-results')).toBeInTheDocument();
  });
});
```

`src/components/LogExplorer/EventDetail.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { EventDetail } from './EventDetail';
import type { LogEvent } from '@/content/types';

const event: LogEvent = {
  id: 'e1',
  timestamp: '2026-08-12T02:14:03Z',
  source: 'edr',
  message: 'Interactive shell spawned',
  fields: { pod: 'ci-deploy-bot-7f9c4d6b6-x2k1p', severity: 'high' },
  arrivesAtStage: 0,
  revealsFact: 'evidence-interactive-shell',
  analystNote: 'Build agents do not run interactive shells.',
};

describe('EventDetail', () => {
  it('prompts the player to select an event when none is selected', () => {
    render(<EventDetail event={null} isPinned={false} onPin={() => {}} onUnpin={() => {}} />);
    expect(screen.getByTestId('no-selection')).toBeInTheDocument();
  });

  it('lists every field of the selected event', () => {
    render(<EventDetail event={event} isPinned={false} onPin={() => {}} onUnpin={() => {}} />);
    expect(screen.getByText('pod')).toBeInTheDocument();
    expect(screen.getByText('ci-deploy-bot-7f9c4d6b6-x2k1p')).toBeInTheDocument();
  });

  it('hides the analyst note until the event is pinned', () => {
    render(<EventDetail event={event} isPinned={false} onPin={() => {}} onUnpin={() => {}} />);
    expect(screen.queryByTestId('analyst-note')).toBeNull();
  });

  it('shows the analyst note once pinned', () => {
    render(<EventDetail event={event} isPinned onPin={() => {}} onUnpin={() => {}} />);
    expect(screen.getByTestId('analyst-note')).toHaveTextContent(
      'Build agents do not run interactive shells.'
    );
  });

  it('pins the event', () => {
    const onPin = vi.fn();
    render(<EventDetail event={event} isPinned={false} onPin={onPin} onUnpin={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: /pin to case file/i }));
    expect(onPin).toHaveBeenCalledWith('e1');
  });

  it('unpins the event', () => {
    const onUnpin = vi.fn();
    render(<EventDetail event={event} isPinned onPin={() => {}} onUnpin={onUnpin} />);
    fireEvent.click(screen.getByRole('button', { name: /remove from case file/i }));
    expect(onUnpin).toHaveBeenCalledWith('e1');
  });

  it('never labels an event as correct or incorrect', () => {
    const { container } = render(
      <EventDetail event={event} isPinned onPin={() => {}} onUnpin={() => {}} />
    );
    expect(container.textContent?.toLowerCase()).not.toMatch(/correct|wrong|right answer/);
  });
});
```

- [ ] **Step 2: Run the tests and verify they fail**

Run: `npm run test -- src/components/LogExplorer`
Expected: FAIL — cannot find module `./ResultsTable`.

- [ ] **Step 3: Implement `ResultsTable`**

`src/components/LogExplorer/ResultsTable.tsx`:

```tsx
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
      <p data-testid="empty-results" className="p-6 text-center font-mono text-xs text-mango-300/50">
        No events match this search in this time range.
        <br />
        Try removing a filter, or widening the time range.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-left font-mono text-xs">
        <thead className="sticky top-0 bg-orchard-900/95 text-mango-300/50">
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
                <td className="whitespace-nowrap px-3 py-1.5 text-mango-300/60">
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
```

- [ ] **Step 4: Implement `EventDetail`**

`src/components/LogExplorer/EventDetail.tsx`:

```tsx
'use client';

import type { LogEvent } from '@/content/types';

interface EventDetailProps {
  event: LogEvent | null;
  isPinned: boolean;
  onPin: (eventId: string) => void;
  onUnpin: (eventId: string) => void;
}

export function EventDetail({ event, isPinned, onPin, onUnpin }: EventDetailProps) {
  if (!event) {
    return (
      <p data-testid="no-selection" className="p-6 text-center text-xs text-mango-300/50">
        Select an event to inspect its fields.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3 p-4">
      <div>
        <p className="font-mono text-xs text-mango-300/60">{event.timestamp}</p>
        <p className="text-sm text-mango-100">{event.message}</p>
      </div>

      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 font-mono text-xs">
        <dt className="text-mango-300/50">source</dt>
        <dd className="break-all text-mango-300">{event.source}</dd>
        {Object.entries(event.fields).map(([field, value]) => (
          <div key={field} className="contents">
            <dt className="text-mango-300/50">{field}</dt>
            <dd className="break-all text-mango-300">{value}</dd>
          </div>
        ))}
      </dl>

      {isPinned ? (
        <>
          <p
            data-testid="analyst-note"
            className="border-l-2 border-mango-500/50 bg-mango-900/40 p-3 text-xs leading-relaxed text-mango-300"
          >
            {event.analystNote}
          </p>
          <button
            type="button"
            onClick={() => onUnpin(event.id)}
            className="self-start text-xs text-mango-300/60 underline hover:text-mango-300"
          >
            Remove from case file
          </button>
        </>
      ) : (
        <button
          type="button"
          onClick={() => onPin(event.id)}
          className="self-start rounded bg-mango-500/20 px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-mango-300 hover:bg-mango-500/30"
        >
          Pin to case file
        </button>
      )}
    </div>
  );
}
```

- [ ] **Step 5: Implement `Histogram`**

`src/components/LogExplorer/Histogram.tsx`:

```tsx
'use client';

import type { LogEvent, TimeRange } from '@/content/types';

interface HistogramProps {
  events: LogEvent[];
  range: TimeRange;
}

const BUCKET_COUNT = 32;

/**
 * Event volume over the selected window. Purely orienting — it shows
 * where activity clusters so the player can see that 02:14 is busier
 * than it should be.
 */
export function Histogram({ events, range }: HistogramProps) {
  const start = Date.parse(range.startIso);
  const span = Math.max(Date.parse(range.endIso) - start, 1);
  const buckets = new Array<number>(BUCKET_COUNT).fill(0);

  for (const event of events) {
    const offset = (Date.parse(event.timestamp) - start) / span;
    if (offset < 0 || offset >= 1) continue;
    buckets[Math.floor(offset * BUCKET_COUNT)] += 1;
  }

  const peak = Math.max(...buckets, 1);

  return (
    <div
      role="img"
      aria-label={`Event volume across ${range.label.toLowerCase()}: ${events.length} events`}
      className="flex h-12 items-end gap-px"
    >
      {buckets.map((count, index) => (
        <div
          key={index}
          className="flex-1 bg-mango-500/50"
          style={{ height: `${Math.max((count / peak) * 100, count > 0 ? 6 : 1)}%` }}
        />
      ))}
    </div>
  );
}
```

- [ ] **Step 6: Run the tests and verify they pass**

Run: `npm run test -- src/components/LogExplorer`
Expected: PASS (23 tests — 10 from Task 8, 13 new).

- [ ] **Step 7: Commit**

```bash
git add src/components/LogExplorer/ResultsTable.tsx src/components/LogExplorer/EventDetail.tsx src/components/LogExplorer/Histogram.tsx src/components/LogExplorer/ResultsTable.test.tsx src/components/LogExplorer/EventDetail.test.tsx
git commit -m "feat: add log explorer results table, event detail, and histogram"
```

---

### Task 10: Log Explorer Composition

**Files:**
- Create: `src/components/LogExplorer/LogExplorer.tsx`
- Test: `src/components/LogExplorer/LogExplorer.test.tsx`

**Interfaces:**
- Consumes: `SearchBar`, `TimeRangeSelect`, `QueryChips`, `ResultsTable`, `EventDetail`, `Histogram`; `parseQuery`, `executeQuery` (`@/engine/logQuery`).
- Produces: `LogExplorer` component.

```ts
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
```

**Behavior to get right:** the input is local state; the `query` prop is the last *submitted* query and is what results derive from. Chips insert their syntax into the bar **and** run it, so the player sees the syntax that produced the results. The hint appears only after **two consecutive** submitted searches that returned nothing — early enough to rescue a stuck player, late enough not to nag.

- [ ] **Step 1: Write the failing test**

`src/components/LogExplorer/LogExplorer.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { LogExplorer } from './LogExplorer';
import type { LogEvent, TimeRange } from '@/content/types';

const events: LogEvent[] = [
  {
    id: 'e1',
    timestamp: '2026-08-12T02:14:03Z',
    source: 'edr',
    message: 'Interactive shell spawned',
    fields: { severity: 'high' },
    arrivesAtStage: 0,
    revealsFact: 'f1',
    analystNote: 'note',
  },
  {
    id: 'e2',
    timestamp: '2026-08-12T02:20:00Z',
    source: 'k8s-audit',
    message: 'get configmaps',
    fields: { severity: 'low' },
    arrivesAtStage: 0,
    analystNote: 'routine',
  },
];

const ranges: TimeRange[] = [
  {
    id: 'last-1h',
    label: 'Last hour',
    startIso: '2026-08-12T02:00:00Z',
    endIso: '2026-08-12T03:00:00Z',
  },
];

function renderExplorer(overrides: Partial<React.ComponentProps<typeof LogExplorer>> = {}) {
  const props = {
    events,
    ranges,
    timeRangeId: 'last-1h',
    query: '',
    suggestions: [{ label: 'High severity', query: 'severity=high' }],
    hint: 'Try narrowing by severity.',
    pinnedIds: [] as string[],
    onQueryChange: vi.fn(),
    onTimeRangeChange: vi.fn(),
    onPin: vi.fn(),
    onUnpin: vi.fn(),
    ...overrides,
  };
  render(<LogExplorer {...props} />);
  return props;
}

describe('LogExplorer', () => {
  it('shows every event for an empty query', () => {
    renderExplorer();
    expect(screen.getByText('Interactive shell spawned')).toBeInTheDocument();
    expect(screen.getByText('get configmaps')).toBeInTheDocument();
  });

  it('filters results by the submitted query', () => {
    renderExplorer({ query: 'severity=high' });
    expect(screen.getByText('Interactive shell spawned')).toBeInTheDocument();
    expect(screen.queryByText('get configmaps')).toBeNull();
  });

  it('surfaces a parse error instead of an empty result set', () => {
    renderExplorer({ query: 'severity=' });
    expect(screen.getByRole('alert')).toHaveTextContent('Missing value for field "severity".');
  });

  it('warns about a field no event carries', () => {
    renderExplorer({ query: 'svrty=high' });
    expect(screen.getByTestId('unknown-fields')).toHaveTextContent('svrty');
  });

  it('submits the typed query', () => {
    const props = renderExplorer();
    fireEvent.change(screen.getByLabelText('search query'), { target: { value: 'severity=low' } });
    fireEvent.submit(screen.getByRole('search'));
    expect(props.onQueryChange).toHaveBeenCalledWith('severity=low');
  });

  it('runs a suggestion chip immediately', () => {
    const props = renderExplorer();
    fireEvent.click(screen.getByRole('button', { name: /High severity/ }));
    expect(props.onQueryChange).toHaveBeenCalledWith('severity=high');
  });

  it('shows an event detail once a row is selected', () => {
    renderExplorer();
    fireEvent.click(screen.getByRole('button', { name: /Interactive shell spawned/ }));
    expect(screen.getByRole('button', { name: /pin to case file/i })).toBeInTheDocument();
  });

  it('withholds the hint until two consecutive searches return nothing', () => {
    renderExplorer();
    const input = screen.getByLabelText('search query');

    fireEvent.change(input, { target: { value: 'severity=nonexistent' } });
    fireEvent.submit(screen.getByRole('search'));
    expect(screen.queryByTestId('hint')).toBeNull();

    fireEvent.change(input, { target: { value: 'severity=alsonothing' } });
    fireEvent.submit(screen.getByRole('search'));
    expect(screen.getByTestId('hint')).toHaveTextContent('Try narrowing by severity.');
  });
});
```

- [ ] **Step 2: Run the test and verify it fails**

Run: `npm run test -- src/components/LogExplorer/LogExplorer.test.tsx`
Expected: FAIL — cannot find module `./LogExplorer`.

- [ ] **Step 3: Implement `LogExplorer`**

`src/components/LogExplorer/LogExplorer.tsx`:

```tsx
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

  const range = ranges.find((candidate) => candidate.id === timeRangeId) ?? ranges[0];

  const parsed = useMemo(() => parseQuery(query), [query]);

  const result = useMemo(() => {
    if (!parsed.ok) return { events: [], unknownFields: [] };
    return executeQuery(parsed.ast, events, range);
  }, [parsed, events, range]);

  // A parent may change `query` on its own — restoring a persisted query,
  // or resetting between stages. The visible input must follow it.
  useEffect(() => {
    setDraft(query);
  }, [query]);

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
```

- [ ] **Step 4: Run the tests and verify they pass**

Run: `npm run test -- src/components/LogExplorer`
Expected: PASS (31 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/LogExplorer/LogExplorer.tsx src/components/LogExplorer/LogExplorer.test.tsx
git commit -m "feat: compose the guided log explorer"
```

---

### Task 11: Attack Map Component

**Files:**
- Create: `src/components/AttackMap/AttackMap.tsx`
- Test: `src/components/AttackMap/AttackMap.test.tsx`

**Interfaces:**
- Consumes: `AttackMapNode`, `AttackMapNodeState`; `deriveNodeState` (`@/content/chapter1/attackMap`); `cn` (`@/lib/cn`).
- Produces: `AttackMap` component.

```ts
interface AttackMapProps {
  nodes: AttackMapNode[];
  facts: string[];
}
```

**Accessibility requirement (non-negotiable):** node state must be legible without color. Each node carries a glyph (`·` undiscovered, `?` suspected, `!` confirmed, `✓` contained) and an `aria-label` naming the state in words. Reviewers should reject a colour-only implementation.

- [ ] **Step 1: Write the failing test**

`src/components/AttackMap/AttackMap.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AttackMap } from './AttackMap';
import type { AttackMapNode } from '@/content/types';

const nodes: AttackMapNode[] = [
  {
    id: 'root',
    label: 'Poisoned build image',
    tactic: 'Initial Access',
    summary: 'Something was already in the image.',
    lesson: 'Not every incident yields a patient zero.',
    prevention: 'Sign and verify images.',
    suspectedByFacts: ['f1'],
    confirmedByFacts: [],
    containedByFacts: [],
    x: 10,
    y: 80,
  },
  {
    id: 'exec',
    label: 'Interactive shell',
    tactic: 'Execution',
    summary: 'A shell ran in the build pod.',
    lesson: 'Build agents do not run shells.',
    prevention: 'Alert on pods/exec.',
    suspectedByFacts: ['f1'],
    confirmedByFacts: ['f1', 'f2'],
    containedByFacts: ['f3'],
    x: 40,
    y: 60,
    parentId: 'root',
  },
];

describe('AttackMap', () => {
  it('renders a node per entry', () => {
    render(<AttackMap nodes={nodes} facts={[]} />);
    expect(screen.getByTestId('map-node-root')).toBeInTheDocument();
    expect(screen.getByTestId('map-node-exec')).toBeInTheDocument();
  });

  it('starts every node undiscovered with no facts', () => {
    render(<AttackMap nodes={nodes} facts={[]} />);
    expect(screen.getByTestId('map-node-exec')).toHaveAttribute('data-state', 'undiscovered');
  });

  it('promotes a node to confirmed once its facts are collected', () => {
    render(<AttackMap nodes={nodes} facts={['f1', 'f2']} />);
    expect(screen.getByTestId('map-node-exec')).toHaveAttribute('data-state', 'confirmed');
  });

  it('marks a node contained once its containment facts land', () => {
    render(<AttackMap nodes={nodes} facts={['f1', 'f2', 'f3']} />);
    expect(screen.getByTestId('map-node-exec')).toHaveAttribute('data-state', 'contained');
  });

  it('names the state in words, not colour alone', () => {
    render(<AttackMap nodes={nodes} facts={['f1', 'f2']} />);
    expect(screen.getByTestId('map-node-exec')).toHaveAttribute(
      'aria-label',
      expect.stringContaining('confirmed')
    );
  });

  it('hides the label of an undiscovered node', () => {
    render(<AttackMap nodes={nodes} facts={[]} />);
    expect(screen.queryByText('Interactive shell')).toBeNull();
  });

  it('reveals the label once the node is at least suspected', () => {
    render(<AttackMap nodes={nodes} facts={['f1']} />);
    expect(screen.getByText('Interactive shell')).toBeInTheDocument();
  });

  it('opens the lesson when a discovered node is clicked', () => {
    render(<AttackMap nodes={nodes} facts={['f1', 'f2']} />);
    fireEvent.click(screen.getByTestId('map-node-exec'));
    expect(screen.getByTestId('map-detail')).toHaveTextContent('Build agents do not run shells.');
    expect(screen.getByTestId('map-detail')).toHaveTextContent('Alert on pods/exec.');
  });

  it('does not open a detail for an undiscovered node', () => {
    render(<AttackMap nodes={nodes} facts={[]} />);
    fireEvent.click(screen.getByTestId('map-node-exec'));
    expect(screen.queryByTestId('map-detail')).toBeNull();
  });

  it('draws a limb between a node and its parent', () => {
    render(<AttackMap nodes={nodes} facts={[]} />);
    expect(screen.getByTestId('map-limb-exec')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the test and verify it fails**

Run: `npm run test -- src/components/AttackMap`
Expected: FAIL — cannot find module `./AttackMap`.

- [ ] **Step 3: Implement `AttackMap`**

`src/components/AttackMap/AttackMap.tsx`:

```tsx
'use client';

import { useState } from 'react';
import type { AttackMapNode, AttackMapNodeState } from '@/content/types';
import { deriveNodeState } from '@/content/chapter1/attackMap';

interface AttackMapProps {
  nodes: AttackMapNode[];
  facts: string[];
}

const STATE_STYLE: Record<
  AttackMapNodeState,
  { fill: string; stroke: string; dash?: string; glyph: string; radius: number }
> = {
  undiscovered: { fill: '#141d16', stroke: '#3b4a3d', dash: '2 3', glyph: '·', radius: 3.2 },
  suspected: { fill: '#2b1d09', stroke: '#f5a623', dash: '3 2', glyph: '?', radius: 4 },
  confirmed: { fill: '#c2372b', stroke: '#e86a5c', glyph: '!', radius: 4.6 },
  contained: { fill: '#1c3a25', stroke: '#4a9d5f', glyph: '✓', radius: 4.2 },
};

/**
 * The kill chain drawn as a branch: limbs grow outward from the trunk,
 * and each node's state is carried by shape and glyph as well as colour
 * so the map stays readable without relying on hue.
 */
export function AttackMap({ nodes, facts }: AttackMapProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const factSet = new Set(facts);
  const stateById = new Map(nodes.map((node) => [node.id, deriveNodeState(node, factSet)]));
  const nodeById = new Map(nodes.map((node) => [node.id, node]));

  const selected = selectedId ? nodeById.get(selectedId) : undefined;
  const selectedState = selectedId ? stateById.get(selectedId) : undefined;

  return (
    <section aria-label="attack path map" className="flex h-full flex-col gap-3">
      {/* No role on the svg: `role="presentation"` alongside interactive
          descendants is inconsistently supported, and the element is not
          focusable anyway. */}
      <svg viewBox="0 0 100 100" className="w-full">
        {nodes.map((node) => {
          if (!node.parentId) return null;
          const parent = nodeById.get(node.parentId);
          if (!parent) return null;
          const state = stateById.get(node.id) ?? 'undiscovered';
          const style = STATE_STYLE[state];
          const midX = (parent.x + node.x) / 2;
          const midY = Math.min(parent.y, node.y) - 6;

          return (
            <path
              key={node.id}
              data-testid={`map-limb-${node.id}`}
              d={`M ${parent.x} ${parent.y} Q ${midX} ${midY} ${node.x} ${node.y}`}
              fill="none"
              stroke={style.stroke}
              strokeWidth={state === 'undiscovered' ? 0.5 : 1.1}
              strokeDasharray={style.dash}
              opacity={state === 'undiscovered' ? 0.45 : 1}
            />
          );
        })}

        {nodes.map((node) => {
          const state = stateById.get(node.id) ?? 'undiscovered';
          const style = STATE_STYLE[state];
          const isDiscovered = state !== 'undiscovered';

          return (
            <g
              key={node.id}
              data-testid={`map-node-${node.id}`}
              data-state={state}
              role={isDiscovered ? 'button' : undefined}
              tabIndex={isDiscovered ? 0 : -1}
              aria-label={`${isDiscovered ? node.label : 'Undiscovered step'} — ${state}`}
              className={isDiscovered ? 'cursor-pointer' : 'cursor-default'}
              onClick={() => isDiscovered && setSelectedId(node.id)}
              onKeyDown={(event) => {
                if (!isDiscovered) return;
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  setSelectedId(node.id);
                }
              }}
            >
              <circle
                cx={node.x}
                cy={node.y}
                r={style.radius}
                fill={style.fill}
                stroke={style.stroke}
                strokeWidth={0.7}
                strokeDasharray={style.dash}
              />
              <text
                x={node.x}
                y={node.y + 1.4}
                fontSize={4}
                fill={style.stroke}
                textAnchor="middle"
                aria-hidden="true"
              >
                {style.glyph}
              </text>
              {isDiscovered && (
                <text
                  x={node.x}
                  y={node.y + style.radius + 4}
                  fontSize={2.8}
                  fill="#ffd27a"
                  textAnchor="middle"
                >
                  {node.label}
                </text>
              )}
            </g>
          );
        })}
      </svg>

      {/* `deriveNodeState` is a pure function of the live facts, with no
          monotonicity guarantee — if facts shrink while a panel is open,
          the panel must close rather than keep showing a node the player
          has no longer proven. */}
      {selected && selectedState && selectedState !== 'undiscovered' && (
        <div
          data-testid="map-detail"
          className="space-y-2 rounded border border-mango-500/30 bg-orchard-900/70 p-3 text-xs leading-relaxed"
        >
          <p className="text-[10px] uppercase tracking-widest text-mango-500">
            {selected.tactic} — {selectedState}
          </p>
          <p className="text-sm text-mango-100">{selected.label}</p>
          <p className="text-mango-300/80">{selected.summary}</p>
          <p className="border-l-2 border-mango-500/50 pl-3 text-mango-300">{selected.lesson}</p>
          <p className="border-l-2 border-leaf-500/60 pl-3 text-leaf-300">{selected.prevention}</p>
          <button
            type="button"
            onClick={() => setSelectedId(null)}
            className="text-mango-300/60 underline hover:text-mango-300"
          >
            Close
          </button>
        </div>
      )}
    </section>
  );
}
```

- [ ] **Step 4: Run the tests and verify they pass**

Run: `npm run test -- src/components/AttackMap`
Expected: PASS (10 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/AttackMap/AttackMap.tsx src/components/AttackMap/AttackMap.test.tsx
git commit -m "feat: add illustrated attack path map component"
```

---

### Task 12: Case File Component

**Files:**
- Create: `src/components/CaseFile/CaseFile.tsx`
- Test: `src/components/CaseFile/CaseFile.test.tsx`

**Interfaces:**
- Consumes: `LogEvent`, `Fact` (`src/content/types.ts`).
- Produces: `CaseFile` component.

```ts
interface CaseFileProps {
  objective: string;
  pinnedEvents: LogEvent[];
  facts: Fact[];
  onUnpin: (eventId: string) => void;
}
```

- [ ] **Step 1: Write the failing test**

`src/components/CaseFile/CaseFile.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CaseFile } from './CaseFile';
import type { Fact, LogEvent } from '@/content/types';

const pinnedEvents: LogEvent[] = [
  {
    id: 'e1',
    timestamp: '2026-08-12T02:14:03Z',
    source: 'edr',
    message: 'Interactive shell spawned',
    fields: {},
    arrivesAtStage: 0,
    revealsFact: 'f1',
    analystNote: 'Build agents do not run interactive shells.',
  },
  {
    id: 'e2',
    timestamp: '2026-08-12T02:20:00Z',
    source: 'k8s-audit',
    message: 'get configmaps',
    fields: {},
    arrivesAtStage: 0,
    analystNote: 'A workload reading its own config. Routine.',
  },
];

const facts: Fact[] = [
  { id: 'f1', label: 'Interactive shell in a build pod', detail: 'EDR caught /bin/sh.' },
];

describe('CaseFile', () => {
  it('shows the current objective', () => {
    render(
      <CaseFile objective="Confirm the alert." pinnedEvents={[]} facts={[]} onUnpin={() => {}} />
    );
    expect(screen.getByTestId('objective')).toHaveTextContent('Confirm the alert.');
  });

  it('lists established facts', () => {
    render(
      <CaseFile objective="o" pinnedEvents={pinnedEvents} facts={facts} onUnpin={() => {}} />
    );
    expect(screen.getByText('Interactive shell in a build pod')).toBeInTheDocument();
  });

  it('shows the analyst note for each pinned event', () => {
    render(
      <CaseFile objective="o" pinnedEvents={pinnedEvents} facts={facts} onUnpin={() => {}} />
    );
    expect(screen.getByText('A workload reading its own config. Routine.')).toBeInTheDocument();
  });

  it('unpins an event', () => {
    const onUnpin = vi.fn();
    render(<CaseFile objective="o" pinnedEvents={pinnedEvents} facts={facts} onUnpin={onUnpin} />);
    fireEvent.click(screen.getAllByRole('button', { name: /remove/i })[0]);
    expect(onUnpin).toHaveBeenCalledWith('e1');
  });

  it('invites the player to start pinning when the file is empty', () => {
    render(<CaseFile objective="o" pinnedEvents={[]} facts={[]} onUnpin={() => {}} />);
    expect(screen.getByTestId('empty-case-file')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the test and verify it fails**

Run: `npm run test -- src/components/CaseFile`
Expected: FAIL — cannot find module `./CaseFile`.

- [ ] **Step 3: Implement `CaseFile`**

`src/components/CaseFile/CaseFile.tsx`:

```tsx
'use client';

import type { Fact, LogEvent } from '@/content/types';

interface CaseFileProps {
  objective: string;
  pinnedEvents: LogEvent[];
  facts: Fact[];
  onUnpin: (eventId: string) => void;
}

export function CaseFile({ objective, pinnedEvents, facts, onUnpin }: CaseFileProps) {
  return (
    <section aria-label="case file" className="flex h-full flex-col gap-4 overflow-y-auto">
      <div>
        <h2 className="text-[10px] uppercase tracking-widest text-mango-500">Objective</h2>
        <p data-testid="objective" className="text-sm leading-relaxed text-mango-100">
          {objective}
        </p>
      </div>

      {facts.length > 0 && (
        <div>
          <h2 className="mb-2 text-[10px] uppercase tracking-widest text-mango-500">Established</h2>
          <ul className="space-y-2">
            {facts.map((fact) => (
              <li key={fact.id} className="border-l-2 border-leaf-500/60 pl-3">
                <p className="text-xs font-semibold text-leaf-300">{fact.label}</p>
                <p className="text-xs leading-relaxed text-mango-300/80">{fact.detail}</p>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div>
        <h2 className="mb-2 text-[10px] uppercase tracking-widest text-mango-500">
          Pinned evidence
        </h2>
        {pinnedEvents.length === 0 ? (
          <p data-testid="empty-case-file" className="text-xs leading-relaxed text-mango-300/50">
            Nothing pinned yet. When a log line looks wrong, pin it here — including the ones that
            turn out to be routine. Ruling evidence out is part of the work.
          </p>
        ) : (
          <ul className="space-y-3">
            {pinnedEvents.map((event) => (
              <li
                key={event.id}
                className="rounded border border-mango-500/20 bg-orchard-900/60 p-3"
              >
                <p className="font-mono text-[10px] text-mango-300/50">
                  {event.timestamp} · {event.source}
                </p>
                <p className="font-mono text-xs text-mango-100">{event.message}</p>
                {event.analystNote && (
                  <p className="mt-2 text-xs leading-relaxed text-mango-300/80">
                    {event.analystNote}
                  </p>
                )}
                <button
                  type="button"
                  onClick={() => onUnpin(event.id)}
                  className="mt-2 text-[10px] uppercase tracking-wider text-mango-300/50 underline hover:text-mango-300"
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
```

- [ ] **Step 4: Run the tests and verify they pass**

Run: `npm run test -- src/components/CaseFile`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/CaseFile/CaseFile.tsx src/components/CaseFile/CaseFile.test.tsx
git commit -m "feat: add case file panel for pinned evidence and established facts"
```

---

### Task 13: Orchard Visual System

**Files:**
- Modify: `tailwind.config.ts`
- Modify: `src/app/globals.css`
- Modify: `src/app/layout.tsx`

**Interfaces:**
- Produces: the `orchard`, `leaf`, and `blight` colour scales plus the extended `mango` scale used by every component written in Tasks 8–12, and the `font-display` / `font-mono` utilities.

**Why no webfont:** `next/font/google` fetches at build time, so the static export would fail on a machine without network access. The display treatment comes from weight, tracking, and case instead.

- [ ] **Step 1: Extend the Tailwind theme**

Replace `tailwind.config.ts`:

```ts
import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Night orchard: the ground everything sits on.
        orchard: {
          950: '#080b09',
          900: '#111a12',
          800: '#18251a',
        },
        // Ripe fruit: primary accent and interface chrome.
        mango: {
          950: '#1a1206',
          900: '#2b1d09',
          700: '#7a4f12',
          500: '#f5a623',
          300: '#ffd27a',
          100: '#ffeccb',
        },
        // Healthy growth: nominal state, containment, prevention guidance.
        leaf: {
          500: '#4a9d5f',
          300: '#8fd4a0',
        },
        // Blight: confirmed compromise.
        blight: {
          600: '#c2372b',
          400: '#e86a5c',
        },
      },
      fontFamily: {
        display: ['"Segoe UI"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['ui-monospace', '"Cascadia Code"', '"JetBrains Mono"', 'Consolas', 'monospace'],
      },
    },
  },
  plugins: [],
};

export default config;
```

- [ ] **Step 2: Rewrite the global stylesheet**

Replace `src/app/globals.css`:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

body {
  @apply bg-orchard-950 text-mango-300 font-display;
  background-image:
    radial-gradient(ellipse 80% 50% at 50% -10%, rgba(245, 166, 35, 0.09), transparent),
    radial-gradient(ellipse 60% 40% at 10% 100%, rgba(74, 157, 95, 0.06), transparent);
  background-attachment: fixed;
}

/* Section headings read as stencilled crate markings. */
.heading-stencil {
  @apply font-display font-bold uppercase tracking-[0.2em] text-mango-500;
}

::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}

::-webkit-scrollbar-track {
  background: transparent;
}

::-webkit-scrollbar-thumb {
  @apply rounded bg-mango-700/50;
}

/* Cinematics are decoration, never the only way to read a state change. */
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

- [ ] **Step 3: Update the document metadata**

Replace `src/app/layout.tsx`:

```tsx
import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Operation Mango',
  description:
    'A cinematic, fully-simulated Kubernetes attack and defense investigation set in the MangoCorp orchard.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
```

- [ ] **Step 4: Verify the styles compile**

Run: `npm run build`
Expected: build succeeds. Tailwind resolves `orchard-*`, `leaf-*`, `blight-*`, and `mango-100/700` — an unknown colour would surface as a missing class, not a hard error, so also confirm no PostCSS warnings appear in the output.

- [ ] **Step 5: Commit**

```bash
git add tailwind.config.ts src/app/globals.css src/app/layout.tsx
git commit -m "feat: add night-orchard visual system"
```

---

### Task 14: Mission Workspace Wiring & Debrief Detection Section

**Files:**
- Modify: `src/app/mission/page.tsx`
- Modify: `src/app/mission/page.test.tsx`
- Modify: `src/components/DebriefPanel/DebriefPanel.tsx`
- Modify: `src/components/DebriefPanel/DebriefPanel.test.tsx`
- Modify: `src/app/debrief/page.tsx`

**Interfaces:**
- Consumes: `LogExplorer`, `AttackMap`, `CaseFile`, `Terminal`, `ClusterDiagram`, `BriefingOverlay`; `useSimStore`, `useHasHydrated`.
- Produces: the composed mission workspace.

**Layout rules:**
- The **terminal renders only when `stage.commands.length > 0`.** In the Sentinel campaign that means it appears for the first time in Stage 5, which is the intended "response console unlocked" beat.
- The **log explorer renders only when the campaign has a `logCorpus`.** The Infiltrator campaign has none, so its workspace is unchanged: terminal plus cluster diagram.
- The **attack map replaces the cluster diagram** whenever the campaign has an `attackMap`.

- [ ] **Step 1: Update the mission page test**

Replace `src/app/mission/page.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { useSimStore } from '@/engine/store';
import { chapter1Campaigns } from '@/content/chapter1';
import MissionPage from './page';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

beforeEach(() => {
  useSimStore.getState().resetProgress();
  localStorage.clear();
});

describe('MissionPage — Infiltrator', () => {
  it('shows the stage briefing first, then the terminal after dismissal', () => {
    useSimStore.getState().startCampaign(chapter1Campaigns.infiltrator);
    render(<MissionPage />);

    expect(screen.getByText('Recon')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Begin'));

    expect(screen.getByLabelText('terminal input')).toBeInTheDocument();
  });

  it('advances the stage when the player runs the full recon command sequence', () => {
    useSimStore.getState().startCampaign(chapter1Campaigns.infiltrator);
    render(<MissionPage />);
    fireEvent.click(screen.getByText('Begin'));

    const input = screen.getByLabelText('terminal input');
    fireEvent.change(input, { target: { value: 'kubectl get pods' } });
    fireEvent.submit(input.closest('form')!);
    fireEvent.change(input, { target: { value: 'kubectl auth can-i --list' } });
    fireEvent.submit(input.closest('form')!);
    fireEvent.change(input, {
      target: { value: 'cat /var/run/secrets/kubernetes.io/serviceaccount/token' },
    });
    fireEvent.submit(input.closest('form')!);

    expect(useSimStore.getState().stageIndex).toBe(1);
  });

  it('does not show a log explorer for a campaign with no corpus', () => {
    useSimStore.getState().startCampaign(chapter1Campaigns.infiltrator);
    render(<MissionPage />);
    fireEvent.click(screen.getByText('Begin'));
    expect(screen.queryByLabelText('log explorer')).toBeNull();
  });
});

describe('MissionPage — Sentinel', () => {
  beforeEach(() => {
    useSimStore.getState().startCampaign(chapter1Campaigns.sentinel);
  });

  it('opens on the log explorer, attack map, and case file', () => {
    render(<MissionPage />);
    fireEvent.click(screen.getByText('Begin'));

    expect(screen.getByLabelText('log explorer')).toBeInTheDocument();
    expect(screen.getByLabelText('attack path map')).toBeInTheDocument();
    expect(screen.getByLabelText('case file')).toBeInTheDocument();
  });

  it('withholds the terminal until a stage has response commands', () => {
    render(<MissionPage />);
    fireEvent.click(screen.getByText('Begin'));
    expect(screen.queryByLabelText('terminal input')).toBeNull();
  });

  it('advances the triage stage when both signal events are pinned', () => {
    render(<MissionPage />);
    fireEvent.click(screen.getByText('Begin'));

    useSimStore.getState().pinEvent('sig-shell-spawn');
    useSimStore.getState().pinEvent('sig-exec-create');

    expect(useSimStore.getState().stageIndex).toBe(1);
  });

  it('shows the terminal once the containment stage is reached', () => {
    const store = useSimStore.getState();
    store.pinEvent('sig-shell-spawn');
    store.pinEvent('sig-exec-create');
    useSimStore.getState().pinEvent('sig-sa-out-of-scope');
    useSimStore.getState().pinEvent('sig-binding-in-effect');
    useSimStore.getState().pinEvent('sig-binding-origin');
    useSimStore.getState().pinEvent('sig-secret-read');
    useSimStore.getState().pinEvent('sig-exfil-egress');
    useSimStore.getState().pinEvent('sig-rogue-sa');
    useSimStore.getState().pinEvent('sig-rogue-binding');

    expect(useSimStore.getState().stageIndex).toBe(4);

    render(<MissionPage />);
    fireEvent.click(screen.getByText('Begin'));
    expect(screen.getByLabelText('terminal input')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the test and verify it fails**

Run: `npm run test -- src/app/mission/page.test.tsx`
Expected: FAIL — no element with the label `log explorer`.

- [ ] **Step 3: Rewrite the mission page**

Replace `src/app/mission/page.tsx`:

```tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSimStore, useHasHydrated } from '@/engine/store';
import { chapter1Campaigns } from '@/content/chapter1';
import { Terminal } from '@/components/Terminal/Terminal';
import { ClusterDiagram } from '@/components/ClusterDiagram/ClusterDiagram';
import { BriefingOverlay } from '@/components/BriefingOverlay/BriefingOverlay';
import { LogExplorer } from '@/components/LogExplorer/LogExplorer';
import { AttackMap } from '@/components/AttackMap/AttackMap';
import { CaseFile } from '@/components/CaseFile/CaseFile';

export default function MissionPage() {
  const router = useRouter();
  const campaignId = useSimStore((state) => state.campaignId);
  const campaign = useSimStore((state) => state.campaign);
  const hydrateCampaign = useSimStore((state) => state.hydrateCampaign);
  const stageIndex = useSimStore((state) => state.stageIndex);
  const revealedFacts = useSimStore((state) => state.revealedFacts);
  const collectedFacts = useSimStore((state) => state.collectedFacts);
  const terminalHistory = useSimStore((state) => state.terminalHistory);
  const clusterStatus = useSimStore((state) => state.clusterStatus);
  const highlightedNodeIds = useSimStore((state) => state.highlightedNodeIds);
  const revealedEdgeIds = useSimStore((state) => state.revealedEdgeIds);
  const pinnedEvidence = useSimStore((state) => state.pinnedEvidence);
  const activeQuery = useSimStore((state) => state.activeQuery);
  const timeRangeId = useSimStore((state) => state.timeRangeId);
  const runCommand = useSimStore((state) => state.runCommand);
  const pinEvent = useSimStore((state) => state.pinEvent);
  const unpinEvent = useSimStore((state) => state.unpinEvent);
  const setQuery = useSimStore((state) => state.setQuery);
  const setTimeRange = useSimStore((state) => state.setTimeRange);

  const [showBriefing, setShowBriefing] = useState(true);
  const hasHydrated = useHasHydrated();

  useEffect(() => {
    // Read campaignId fresh from the store here rather than trusting the
    // `campaignId` selector value captured at render time: `hasHydrated`
    // flips via a separate manually-polled effect (see useHasHydrated),
    // not through the same zustand subscription tick as `campaignId`, so a
    // render can transiently see `hasHydrated: true` paired with a
    // not-yet-updated `campaignId` selector snapshot even though the
    // store's real, current state already has the correct value.
    if (hasHydrated && !useSimStore.getState().campaignId) {
      router.replace('/campaign-select');
    }
  }, [hasHydrated, campaignId, router]);

  useEffect(() => {
    if (hasHydrated && campaignId && !campaign) {
      hydrateCampaign(chapter1Campaigns[campaignId]);
    }
  }, [hasHydrated, campaignId, campaign, hydrateCampaign]);

  useEffect(() => {
    setShowBriefing(true);
  }, [stageIndex]);

  useEffect(() => {
    if (campaign && stageIndex >= campaign.stages.length) {
      router.push('/debrief');
    }
  }, [campaign, stageIndex, router]);

  const stage = campaign?.stages[stageIndex];

  /** Only what the index has received by this stage is searchable. */
  const arrivedEvents = useMemo(
    () => (campaign?.logCorpus ?? []).filter((event) => event.arrivesAtStage <= stageIndex),
    [campaign, stageIndex]
  );

  const pinnedEvents = useMemo(
    () => (campaign?.logCorpus ?? []).filter((event) => pinnedEvidence.includes(event.id)),
    [campaign, pinnedEvidence]
  );

  const establishedFacts = useMemo(
    () =>
      collectedFacts
        .map((factId) => campaign?.factLibrary[factId])
        .filter((fact): fact is NonNullable<typeof fact> => fact !== undefined),
    [collectedFacts, campaign]
  );

  if (!hasHydrated || !campaignId || !campaign || !stage) return null;

  const revealedSet = new Set(revealedFacts);
  const availableCommands = stage.commands.filter((command) =>
    (command.requiresFacts ?? []).every((factId) => revealedSet.has(factId))
  );

  const hasLogExplorer = (campaign.logCorpus?.length ?? 0) > 0;
  const hasAttackMap = (campaign.attackMap?.length ?? 0) > 0;
  const showTerminal = stage.commands.length > 0;

  return (
    <main className="flex min-h-screen flex-col gap-4 p-4 lg:p-6">
      {showBriefing && (
        <BriefingOverlay
          title={stage.title}
          objective={stage.objective}
          lines={stage.briefing}
          onDismiss={() => setShowBriefing(false)}
        />
      )}

      <header className="flex items-baseline justify-between border-b border-mango-500/20 pb-3">
        <h1 className="heading-stencil text-sm">
          {campaign.title} — {stage.title}
        </h1>
        <p className="font-mono text-xs text-mango-300/50">
          Stage {stageIndex + 1} of {campaign.stages.length}
        </p>
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 xl:grid-cols-[3fr_1.4fr]">
        <div className="flex min-h-0 flex-col gap-4">
          {hasLogExplorer && (
            <div className="min-h-[28rem] flex-1">
              <LogExplorer
                events={arrivedEvents}
                ranges={campaign.timeRanges ?? []}
                timeRangeId={timeRangeId}
                query={activeQuery}
                suggestions={stage.suggestedQueries ?? []}
                hint={stage.hint}
                pinnedIds={pinnedEvidence}
                onQueryChange={setQuery}
                onTimeRangeChange={setTimeRange}
                onPin={pinEvent}
                onUnpin={unpinEvent}
              />
            </div>
          )}

          {showTerminal && (
            <Terminal
              history={terminalHistory}
              availableCommands={availableCommands}
              onSubmit={runCommand}
            />
          )}
        </div>

        <aside className="flex min-h-0 flex-col gap-4">
          <div className="rounded border border-mango-500/20 bg-orchard-900/40 p-3">
            {hasAttackMap ? (
              <AttackMap nodes={campaign.attackMap ?? []} facts={collectedFacts} />
            ) : (
              <ClusterDiagram
                highlightedNodeIds={highlightedNodeIds}
                revealedEdgeIds={revealedEdgeIds}
                status={clusterStatus}
              />
            )}
          </div>

          <div className="min-h-0 flex-1 rounded border border-mango-500/20 bg-orchard-900/40 p-3">
            <CaseFile
              objective={stage.objective}
              pinnedEvents={pinnedEvents}
              facts={establishedFacts}
              onUnpin={unpinEvent}
            />
          </div>
        </aside>
      </div>
    </main>
  );
}
```

- [ ] **Step 4: Run the mission tests and verify they pass**

Run: `npm run test -- src/app/mission/page.test.tsx`
Expected: PASS (7 tests).

- [ ] **Step 5: Add the detection section to the debrief panel**

Add a `detection` prop to `src/components/DebriefPanel/DebriefPanel.tsx`. Replace the file:

```tsx
'use client';

interface DebriefPanelProps {
  narrative: string[];
  lesson: string;
  detection?: string[];
  nextChapterTeaser: string;
  onRestart: () => void;
}

export function DebriefPanel({
  narrative,
  lesson,
  detection,
  nextChapterTeaser,
  onRestart,
}: DebriefPanelProps) {
  return (
    <div className="mx-auto max-w-2xl space-y-6 p-8">
      <section data-testid="debrief-narrative" className="space-y-2">
        {narrative.map((line, index) => (
          <p key={index}>{line}</p>
        ))}
      </section>

      <section className="rounded-lg border border-mango-500/40 p-4">
        <h3 className="mb-2 font-bold text-mango-500">Real-World Lesson</h3>
        <p>{lesson}</p>
      </section>

      {detection && detection.length > 0 && (
        <section data-testid="debrief-detection" className="rounded-lg border border-leaf-500/40 p-4">
          <h3 className="mb-2 font-bold text-leaf-300">How You Would Catch This</h3>
          <ul className="space-y-2 text-sm">
            {detection.map((rule, index) => (
              <li key={index} className="border-l-2 border-leaf-500/50 pl-3">
                {rule}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="text-sm italic text-mango-500/70">{nextChapterTeaser}</section>

      <button
        onClick={onRestart}
        className="rounded bg-mango-500 px-4 py-2 font-semibold text-mango-950"
      >
        Return to Briefing
      </button>
    </div>
  );
}
```

- [ ] **Step 6: Add a debrief panel test for the detection section**

Add to `src/components/DebriefPanel/DebriefPanel.test.tsx`:

```tsx
  it('shows detection guidance when supplied', () => {
    render(
      <DebriefPanel
        narrative={['n']}
        lesson="l"
        detection={['Alert on create pods/exec.']}
        nextChapterTeaser="t"
        onRestart={() => {}}
      />
    );
    expect(screen.getByTestId('debrief-detection')).toHaveTextContent(
      'Alert on create pods/exec.'
    );
  });

  it('omits the detection section when none is supplied', () => {
    render(
      <DebriefPanel narrative={['n']} lesson="l" nextChapterTeaser="t" onRestart={() => {}} />
    );
    expect(screen.queryByTestId('debrief-detection')).toBeNull();
  });
```

- [ ] **Step 7: Pass `detection` through from the debrief page**

In `src/app/debrief/page.tsx`, add `detection={campaign.debrief.detection}` to the `<DebriefPanel ... />` element, alongside the existing `lesson` and `nextChapterTeaser` props.

- [ ] **Step 8: Run the full suite and verify it passes**

Run: `npm run test`
Expected: PASS — every suite.

- [ ] **Step 9: Commit**

```bash
git add src/app/mission/page.tsx src/app/mission/page.test.tsx src/components/DebriefPanel/DebriefPanel.tsx src/components/DebriefPanel/DebriefPanel.test.tsx src/app/debrief/page.tsx
git commit -m "feat: wire log explorer, attack map, and case file into the mission workspace"
```

---

### Task 15: Cinematic Motion Pass

**Files:**
- Modify: `src/components/AttackMap/AttackMap.tsx`
- Modify: `src/components/CaseFile/CaseFile.tsx`
- Test: `src/components/AttackMap/AttackMap.test.tsx` (add one case)

**Interfaces:**
- Consumes: `motion`, `AnimatePresence`, `useReducedMotion` (`framer-motion`, already a dependency).
- Produces: no new exports — behavior only.

**Why this is its own task:** motion is decoration layered onto components that already work and are already tested. Keeping it separate means the investigation flow can be reviewed on its merits first, and a motion regression can be reverted without touching logic.

**The two beats worth animating** (resist adding more — ambient motion in a log table makes it harder to read, not more cinematic):
1. An attack-map node **ignites** when it first becomes confirmed.
2. A pinned evidence card **arrives** in the case file rather than appearing instantly.

`useReducedMotion()` must gate both. The CSS in Task 13 neutralises CSS transitions, but Framer Motion animates inline styles via JS and is **not** covered by that media query — it has to be handled in the component.

- [ ] **Step 1: Write the failing test**

Add to `describe('AttackMap', ...)` in `src/components/AttackMap/AttackMap.test.tsx`:

```tsx
  it('marks a confirmed node as ignited for the motion layer', () => {
    render(<AttackMap nodes={nodes} facts={['f1', 'f2']} />);
    expect(screen.getByTestId('map-node-exec')).toHaveAttribute('data-ignited', 'true');
  });

  it('does not mark an undiscovered node as ignited', () => {
    render(<AttackMap nodes={nodes} facts={[]} />);
    expect(screen.getByTestId('map-node-exec')).toHaveAttribute('data-ignited', 'false');
  });
```

- [ ] **Step 2: Run the test and verify it fails**

Run: `npm run test -- src/components/AttackMap`
Expected: FAIL — expected the element to have attribute `data-ignited`.

- [ ] **Step 3: Add the ignite animation to `AttackMap`**

In `src/components/AttackMap/AttackMap.tsx`, add the import:

```tsx
import { motion, useReducedMotion } from 'framer-motion';
```

Inside the component, above the `return`, add:

```tsx
  const reduceMotion = useReducedMotion();
```

Replace the plain `<circle .../>` inside the node `<g>` with an animated one, and add the `data-ignited` attribute to the `<g>`. The `<g>` opening tag gains one attribute:

```tsx
              data-ignited={String(state === 'confirmed' || state === 'contained')}
```

and the circle becomes:

```tsx
              <motion.circle
                cx={node.x}
                cy={node.y}
                r={style.radius}
                fill={style.fill}
                stroke={style.stroke}
                strokeWidth={0.7}
                strokeDasharray={style.dash}
                initial={false}
                animate={
                  reduceMotion
                    ? { scale: 1, opacity: 1 }
                    : {
                        scale: state === 'confirmed' ? [1, 1.35, 1] : 1,
                        opacity: 1,
                      }
                }
                transition={{ duration: reduceMotion ? 0 : 0.7, ease: 'easeOut' }}
                style={{ transformOrigin: `${node.x}px ${node.y}px` }}
              />
```

- [ ] **Step 4: Animate evidence arriving in the case file**

In `src/components/CaseFile/CaseFile.tsx`, add the import:

```tsx
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
```

Add `const reduceMotion = useReducedMotion();` at the top of the component body, wrap the pinned-evidence `<ul>` contents in `<AnimatePresence initial={false}>`, and change each pinned `<li>` to:

```tsx
              <motion.li
                key={event.id}
                layout={!reduceMotion}
                initial={reduceMotion ? false : { opacity: 0, x: 24 }}
                animate={{ opacity: 1, x: 0 }}
                exit={reduceMotion ? { opacity: 0 } : { opacity: 0, x: 24 }}
                transition={{ duration: reduceMotion ? 0 : 0.28, ease: 'easeOut' }}
                className="rounded border border-mango-500/20 bg-orchard-900/60 p-3"
              >
```

with the matching closing tag changed to `</motion.li>`.

- [ ] **Step 5: Run the full suite and verify it passes**

Run: `npm run test`
Expected: PASS — including the two new AttackMap cases and the unchanged CaseFile cases.

- [ ] **Step 6: Commit**

```bash
git add src/components/AttackMap/AttackMap.tsx src/components/AttackMap/AttackMap.test.tsx src/components/CaseFile/CaseFile.tsx
git commit -m "feat: add ignite and evidence-arrival motion, gated on reduced-motion"
```

---

### Task 16: Build Verification, Content Validation & Manual Playtest

**Files:**
- Modify: `package.json` (widen the content-validation script)
- Modify: `README.md`

- [ ] **Step 1: Widen the content validation script**

In `package.json`, replace the `validate:content` script with one that also runs the corpus and attack-map integrity suites:

```json
    "validate:content": "vitest run src/content",
```

- [ ] **Step 2: Run the full verification sweep**

Run each and confirm the stated result before continuing:

```bash
npm run test
```
Expected: PASS, no failures, no skipped suites.

```bash
npm run validate:content
```
Expected: PASS — reachability, corpus integrity, noise ratio, and attack-map integrity.

```bash
npm run build
```
Expected: static export completes with no type errors and no build warnings.

- [ ] **Step 3: Manually play the Sentinel campaign end to end**

Run `npm run dev` and play through, confirming each of these:

1. Stage 1 opens on the log explorer with the terminal **absent**.
2. `source=edr severity=high` surfaces the shell-spawn event; pinning it adds a fact to the case file and lights `execution` on the attack map.
3. Pinning the exec-create event advances to Stage 2 and the briefing appears.
4. In Stage 2, `resource=clusterrolebindings` on the default **Last hour** range finds nothing useful; switching to **All time** surfaces the fourteen-month-old binding creation. Confirm the hint appears after two consecutive empty searches.
5. Stage 4 shows the rogue service account and binding, which did **not** exist in the index during Stage 1.
6. Stage 5 shows the terminal for the first time; the five response commands run in order and the last one advances to the debrief.
7. The debrief shows narrative, lesson, the detection section, and the teaser.
8. Reload the page mid-stage: progress, pinned evidence, and the active query all survive.

- [ ] **Step 4: Regression-check the Infiltrator campaign**

Play Infiltrator through at least Stage 2 and confirm the workspace is unchanged: terminal plus cluster diagram, no log explorer, no attack map.

- [ ] **Step 5: Check reduced motion and keyboard access**

- With `prefers-reduced-motion: reduce` enabled in the browser's rendering settings, confirm no animation plays.
- Tab through the log explorer: the query input, search button, chips, result rows, and pin button must all be reachable and activatable from the keyboard.
- Confirm attack-map node states are distinguishable with colour filters off (each carries a glyph and a state word in its label).

- [ ] **Step 6: Update the README**

Replace the description paragraph in `README.md` with:

```markdown
A cinematic, fully-simulated Kubernetes attack/defense learning site. MangoCorp,
a fictional agri-tech company, is mid-breach: play the Infiltrator (the
cybercrime crew Citrus Dynamics hired) or the Sentinel (MangoCorp security)
through Chapter 1, "Privileged Access" — an RBAC-misconfiguration /
privilege-escalation storyline told from both sides.

The Sentinel campaign is played as an investigation. A searchable corpus of
simulated endpoint, Kubernetes audit, API server, and CI/CD logs is filtered
with a Splunk-style query language; progress comes from recognising the
anomalous log line and pinning it as evidence, which fills in an illustrated
attack path map. The terminal appears only at containment, for response
actions.

Everything is simulated client-side: there is no real Kubernetes cluster and
no backend. See `docs/superpowers/specs/2026-07-23-mango-k8s-sim-design.md`
and `docs/superpowers/specs/2026-08-12-siem-log-explorer-and-attack-map-design.md`
for the full design.
```

- [ ] **Step 7: Commit**

```bash
git add package.json README.md
git commit -m "chore: widen content validation and document the investigation flow"
```
