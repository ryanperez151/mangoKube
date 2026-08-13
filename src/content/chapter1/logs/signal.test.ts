import { describe, it, expect } from 'vitest';
import { signalEvents } from './signal';
import { TIME_RANGES } from './timeRanges';
import { isChoiceVisible } from '@/engine/conditions';

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

  it.each([
    { 'containment-timing': 'hunt-first' },
    { 'containment-timing': 'contain-now' },
  ])('reveals each fact from exactly one event on the selected containment route', (decisions) => {
    const facts = signalEvents
      .filter((event) => isChoiceVisible(event.visibleWhen, decisions))
      .map((event) => event.revealsFact);
    expect(new Set(facts).size).toBe(facts.length);
  });

  it('attributes the early-containment persistence pivot to a session other than the revoked CI identity', () => {
    const pivotEvents = signalEvents.filter(
      (event) => event.visibleWhen?.['containment-timing'] === 'contain-now'
    );

    expect(pivotEvents).toHaveLength(2);
    expect(pivotEvents.map((event) => event.fields.user)).toEqual([
      'external-operator@203.0.113.44',
      'external-operator@203.0.113.44',
    ]);
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
