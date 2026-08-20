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
