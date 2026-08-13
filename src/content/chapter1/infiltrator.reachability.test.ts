import { describe, it, expect } from 'vitest';
import { findAdvancePath } from '@/engine/reachability';
import { isChoiceVisible } from '@/engine/conditions';
import { infiltratorCampaign } from './infiltrator';

describe('infiltratorCampaign', () => {
  it('uses the cinematic role, objective, guidance, and resolution contracts in every stage', () => {
    expect(infiltratorCampaign.role).toEqual({
      fantasy: expect.any(String),
      primaryMechanic: expect.any(String),
      learningFocus: expect.any(String),
    });

    for (const stage of infiltratorCampaign.stages) {
      expect(stage.objectiveSteps?.length, `stage "${stage.id}" has no objective steps`).toBeGreaterThan(0);
      expect(stage.objectiveSteps?.every((step) => step.requiresFacts.length > 0)).toBe(true);
      expect(stage.guidance?.map((step) => step.level), `stage "${stage.id}" has incomplete guidance`).toEqual([1, 2, 3]);
      expect(stage.resolution, `stage "${stage.id}" has no resolution`).toBeDefined();
      expect(stage.advanceWhen?.facts.length, `stage "${stage.id}" has no fact completion`).toBeGreaterThan(0);
      expect(stage.commands.some((command) => command.outcome.advances === true)).toBe(false);
    }
  });

  it.each([
    ['exfil-first', ['ultra-mango-genome-db', 'create serviceaccount', 'create clusterrolebinding']],
    ['persistence-first', ['create serviceaccount', 'create clusterrolebinding', 'ultra-mango-genome-db']],
  ] as const)('keeps the %s operational route reachable in its required command order', (optionId, fragments) => {
    const escalation = infiltratorCampaign.stages[3];
    const path = findAdvancePath(escalation, { decisions: { 'operational-order': optionId } });

    expect(path).not.toBeNull();
    const positions = fragments.map((fragment) => path!.findIndex((command) => command.includes(fragment)));
    expect(positions.every((position) => position >= 0)).toBe(true);
    expect(positions).toEqual([...positions].sort((a, b) => a - b));
  });

  it('uses choice-visible escalation commands that converge on the same three facts', () => {
    const escalation = infiltratorCampaign.stages[3];
    expect(escalation.decision?.timing).toBe('before-stage');
    const expectedFacts = ['exfiltrated-ip', 'persistence-sa-created', 'persistence-binding-created'];

    for (const optionId of ['exfil-first', 'persistence-first']) {
      const commands = escalation.commands.filter((command) =>
        isChoiceVisible(command.visibleWhen, { 'operational-order': optionId })
      );
      expect(new Set(commands.flatMap((command) => command.outcome.revealsFacts ?? []))).toEqual(
        new Set(expectedFacts)
      );
    }
  });

  it('references known facts and valid decision options from content contracts', () => {
    const knownFacts = new Set(Object.keys(infiltratorCampaign.factLibrary));
    const decisions = new Map(
      infiltratorCampaign.stages.flatMap((stage) =>
        stage.decision ? [[stage.decision.id, new Set(stage.decision.options.map((option) => option.id))] as const] : []
      )
    );

    for (const stage of infiltratorCampaign.stages) {
      for (const factId of [
        ...(stage.advanceWhen?.facts ?? []),
        ...(stage.objectiveSteps ?? []).flatMap((step) => step.requiresFacts),
        ...stage.commands.flatMap((command) => [
          ...(command.requiresFacts ?? []),
          ...(command.outcome.revealsFacts ?? []),
        ]),
        ...(stage.decision?.options.flatMap((option) => option.effects?.revealsFacts ?? []) ?? []),
      ]) {
        expect(knownFacts.has(factId), `unknown fact "${factId}"`).toBe(true);
      }

      for (const condition of [
        ...stage.commands.map((command) => command.visibleWhen),
        ...(stage.objectiveSteps ?? []).map((step) => step.visibleWhen),
        ...(stage.guidance ?? []).map((step) => step.visibleWhen),
        ...((stage.conditionalBriefing ?? []).map((copy) => copy.when)),
        ...((stage.resolution?.conditionalSummary ?? []).map((copy) => copy.when)),
      ]) {
        for (const [decisionId, optionId] of Object.entries(condition ?? {})) {
          expect(decisions.get(decisionId)?.has(optionId), `unknown choice ${decisionId}:${optionId}`).toBe(true);
        }
      }
    }

    for (const copy of infiltratorCampaign.conditionalDebrief ?? []) {
      for (const [decisionId, optionId] of Object.entries(copy.when ?? {})) {
        expect(decisions.get(decisionId)?.has(optionId), `unknown debrief choice ${decisionId}:${optionId}`).toBe(true);
      }
    }
  });
});
