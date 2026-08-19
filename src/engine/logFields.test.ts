import { describe, it, expect } from 'vitest';
import {
  applyValueFilter,
  buildFieldCatalog,
  moveColumnField,
  removeColumnField,
  sortEvents,
  summarizeFieldValues,
  toggleColumnField,
} from './logFields';
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
