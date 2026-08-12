import { describe, it, expect } from 'vitest';
import { findAdvancePath } from '@/engine/reachability';
import { sentinelCampaign } from './sentinel';

describe('sentinelCampaign', () => {
  it('has a reachable advance path in every stage', () => {
    sentinelCampaign.stages.forEach((stage, stageIndex) => {
      const path = findAdvancePath(stage, {
        events: sentinelCampaign.logCorpus,
        stageIndex,
      });
      expect(path, `stage "${stage.id}" has no reachable advance path`).not.toBeNull();
    });
  });

  it('has a factLibrary entry for every fact referenced by any command', () => {
    const referenced = new Set<string>();
    for (const stage of sentinelCampaign.stages) {
      for (const command of stage.commands) {
        (command.outcome.revealsFacts ?? []).forEach((factId) => referenced.add(factId));
        (command.requiresFacts ?? []).forEach((factId) => referenced.add(factId));
      }
      (stage.advanceWhen?.facts ?? []).forEach((factId) => referenced.add(factId));
    }
    for (const factId of referenced) {
      expect(
        sentinelCampaign.factLibrary[factId],
        `missing factLibrary entry for "${factId}"`
      ).toBeDefined();
    }
  });

  it('has a factLibrary entry for every fact revealed by a log event', () => {
    for (const event of sentinelCampaign.logCorpus ?? []) {
      if (!event.revealsFact) continue;
      expect(
        sentinelCampaign.factLibrary[event.revealsFact],
        `event "${event.id}" reveals unknown fact "${event.revealsFact}"`
      ).toBeDefined();
    }
  });

  it('investigates in the SIEM and responds in the terminal', () => {
    const withCommands = sentinelCampaign.stages.filter((stage) => stage.commands.length > 0);
    expect(withCommands.map((stage) => stage.id)).toEqual(['containment']);
  });

  it('gives every SIEM stage suggested queries and a hint', () => {
    for (const stage of sentinelCampaign.stages) {
      if (stage.commands.length > 0) continue;
      expect(stage.suggestedQueries?.length, `stage "${stage.id}" has no suggestions`).toBeGreaterThan(0);
      expect(stage.hint, `stage "${stage.id}" has no hint`).toBeTruthy();
    }
  });

  it('carries its log corpus, attack map, and time ranges', () => {
    expect(sentinelCampaign.logCorpus?.length).toBeGreaterThan(100);
    expect(sentinelCampaign.attackMap?.length).toBeGreaterThan(0);
    expect(sentinelCampaign.timeRanges?.length).toBeGreaterThan(0);
  });
});
