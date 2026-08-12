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
