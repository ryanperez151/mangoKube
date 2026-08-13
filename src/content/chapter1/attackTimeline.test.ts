import { describe, expect, it } from 'vitest';
import { chapter1AttackTimeline } from './attackTimeline';
import { sentinelAttackMap } from './attackMap';
import { sentinelLogCorpus } from './logs';
import { signalEvents } from './logs/signal';
import { infiltratorCampaign } from './infiltrator';
import { sentinelCampaign } from './sentinel';
import { resolveArtifacts } from '@/engine/attackTimeline';

const corpusIds = new Set(sentinelLogCorpus.map((event) => event.id));
const nodeIds = new Set(sentinelAttackMap.map((node) => node.id));

describe('chapter 1 attack timeline', () => {
  it('references only real corpus events', () => {
    for (const entry of chapter1AttackTimeline) {
      for (const eventId of entry.artifactEventIds) {
        expect(corpusIds, `${entry.id} -> ${eventId}`).toContain(eventId);
      }
    }
  });

  it('references only real attack map nodes', () => {
    for (const entry of chapter1AttackTimeline) {
      expect(nodeIds, entry.id).toContain(entry.nodeId);
    }
  });

  it('references only facts each campaign actually defines', () => {
    for (const entry of chapter1AttackTimeline) {
      for (const factId of entry.infiltratorFacts ?? []) {
        expect(infiltratorCampaign.factLibrary, `${entry.id} -> ${factId}`).toHaveProperty(factId);
      }
      for (const factId of entry.sentinelFacts) {
        expect(sentinelCampaign.factLibrary, `${entry.id} -> ${factId}`).toHaveProperty(factId);
      }
    }
  });

  it('runs in ascending timestamp order', () => {
    const times = chapter1AttackTimeline.map((entry) => Date.parse(entry.timestamp));
    expect(times.some(Number.isNaN)).toBe(false);
    expect(times).toEqual([...times].sort((a, b) => a - b));
  });

  it('uses unique entry ids', () => {
    const ids = chapter1AttackTimeline.map((entry) => entry.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('accounts for every signal event exactly once', () => {
    const claimed = chapter1AttackTimeline.flatMap((entry) => entry.artifactEventIds);
    expect(new Set(claimed).size, 'an artifact is claimed by two steps').toBe(claimed.length);
    for (const event of signalEvents) {
      expect(claimed, `${event.id} is evidence no timeline step explains`).toContain(event.id);
    }
  });

  it('explains every step that leaves no artifact', () => {
    for (const entry of chapter1AttackTimeline) {
      if (entry.artifactEventIds.length === 0) {
        expect(entry.artifactNote, `${entry.id} needs an artifactNote`).toBeTruthy();
      } else {
        expect(entry.artifactNote, `${entry.id} has artifacts and a note`).toBeUndefined();
      }
    }
  });

  it('only claims artifacts for steps that are actually observable', () => {
    for (const entry of chapter1AttackTimeline) {
      if (entry.observability !== 'alerting') {
        expect(entry.artifactEventIds, `${entry.id} is ${entry.observability}`).toHaveLength(0);
      }
    }
  });

  it('gives every step usable detection guidance', () => {
    for (const entry of chapter1AttackTimeline) {
      expect(entry.detection.rule.length, entry.id).toBeGreaterThan(20);
    }
  });

  it('covers every fact the Sentinel can establish from the corpus', () => {
    const explained = new Set(chapter1AttackTimeline.flatMap((entry) => entry.sentinelFacts));
    const pinnable = new Set(
      sentinelLogCorpus.flatMap((event) => (event.revealsFact ? [event.revealsFact] : []))
    );
    for (const factId of pinnable) {
      expect(explained, `${factId} is pinnable but absent from the timeline`).toContain(factId);
    }
  });

  it('resolves one artifact per step on each Sentinel decision route', () => {
    for (const route of ['hunt-first', 'contain-now']) {
      const decisions = { 'containment-timing': route };
      for (const entry of chapter1AttackTimeline) {
        const resolved = resolveArtifacts(entry, sentinelLogCorpus, decisions);
        expect(
          resolved.length,
          `${entry.id} resolved ${resolved.length} artifacts on ${route}`
        ).toBe(entry.artifactEventIds.length === 0 ? 0 : 1);
      }
    }
  });

  it('falls back to the canonical artifact when no decision governs', () => {
    const persistence = chapter1AttackTimeline.find((entry) => entry.id === 'plant-rogue-account');
    const resolved = resolveArtifacts(persistence!, sentinelLogCorpus, {});
    expect(resolved.map((event) => event.id)).toEqual(['sig-rogue-sa']);
  });
});
