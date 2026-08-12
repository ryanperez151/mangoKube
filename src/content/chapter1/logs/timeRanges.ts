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
