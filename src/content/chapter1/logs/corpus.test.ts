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
