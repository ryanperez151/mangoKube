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
