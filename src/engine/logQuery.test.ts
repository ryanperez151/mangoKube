import { describe, it, expect } from 'vitest';
import { parseQuery, executeQuery, splitPredicate } from './logQuery';
import type { LogEvent, TimeRange } from '@/content/types';

describe('splitPredicate', () => {
  it('splits a field=value token', () => {
    expect(splitPredicate('source=edr')).toEqual({ field: 'source', value: 'edr', negated: false });
  });

  it('splits a negated token', () => {
    expect(splitPredicate('-user=alice')).toEqual({ field: 'user', value: 'alice', negated: true });
  });

  it('returns null for a bare term carrying no "="', () => {
    expect(splitPredicate('healthz')).toBeNull();
  });

  it('returns null for a negated bare term', () => {
    expect(splitPredicate('-healthz')).toBeNull();
  });

  it('reports an empty field for a leading "="', () => {
    expect(splitPredicate('=ci-deploy-bot')).toEqual({
      field: '',
      value: 'ci-deploy-bot',
      negated: false,
    });
  });

  it('reports an empty value for a trailing "="', () => {
    expect(splitPredicate('user=')).toEqual({ field: 'user', value: '', negated: false });
  });
});

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

  it('resolves an escaped quote inside a quoted value', () => {
    const result = parseQuery('reason="RBAC: allowed by ClusterRoleBinding \\"ci-deploy-bot-binding\\""');
    expect(result.ok && result.ast.predicates[0].value).toBe(
      'RBAC: allowed by ClusterRoleBinding "ci-deploy-bot-binding"'
    );
  });

  it('rejects a negated bare term rather than silently including it', () => {
    expect(parseQuery('-healthz')).toEqual({
      ok: false,
      error: 'Negated bare terms are not supported — use -field=value.',
    });
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
