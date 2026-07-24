import { describe, it, expect } from 'vitest';
import { findAdvancePath } from '@/engine/reachability';
import { infiltratorCampaign } from './infiltrator';

describe('infiltratorCampaign', () => {
  it('has a reachable advance path in every stage', () => {
    for (const stage of infiltratorCampaign.stages) {
      const path = findAdvancePath(stage);
      expect(path, `stage "${stage.id}" has no reachable advance command`).not.toBeNull();
    }
  });

  it('has a factLibrary entry for every fact referenced by any command', () => {
    const referenced = new Set<string>();
    for (const stage of infiltratorCampaign.stages) {
      for (const command of stage.commands) {
        (command.outcome.revealsFacts ?? []).forEach((f) => referenced.add(f));
        (command.requiresFacts ?? []).forEach((f) => referenced.add(f));
      }
    }
    for (const factId of referenced) {
      expect(
        infiltratorCampaign.factLibrary[factId],
        `missing factLibrary entry for "${factId}"`
      ).toBeDefined();
    }
  });
});
