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
