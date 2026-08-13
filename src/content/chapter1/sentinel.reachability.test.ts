import { describe, it, expect } from 'vitest';
import { findAdvancePath } from '@/engine/reachability';
import { isChoiceVisible } from '@/engine/conditions';
import { sentinelCampaign } from './sentinel';

describe('sentinelCampaign', () => {
  it('uses the cinematic role, objective, guidance, and resolution contracts in every stage', () => {
    expect(sentinelCampaign.role).toEqual({
      fantasy: expect.any(String),
      primaryMechanic: expect.any(String),
      learningFocus: expect.any(String),
    });

    for (const stage of sentinelCampaign.stages) {
      expect(stage.objectiveSteps?.length, `stage "${stage.id}" has no objective steps`).toBeGreaterThan(0);
      expect(stage.objectiveSteps?.every((step) => step.requiresFacts.length > 0)).toBe(true);
      // A stage may offer route-specific tiers, so completeness is judged per
      // route: whichever containment choice is in play must still see 1, 2, 3.
      for (const optionId of ['contain-now', 'hunt-first'] as const) {
        const levels = (stage.guidance ?? [])
          .filter((step) => isChoiceVisible(step.visibleWhen, { 'containment-timing': optionId }))
          .map((step) => step.level);
        expect(levels, `stage "${stage.id}" has incomplete guidance on ${optionId}`).toEqual([1, 2, 3]);
      }
      expect(stage.resolution, `stage "${stage.id}" has no resolution`).toBeDefined();
      expect(stage.advanceWhen?.facts.length, `stage "${stage.id}" has no fact completion`).toBeGreaterThan(0);
      expect(stage.commands.some((command) => command.outcome.advances === true)).toBe(false);
      expect(stage.suggestedQueries, `stage "${stage.id}" still exposes suggestion chips`).toBeUndefined();
      expect(stage.hint, `stage "${stage.id}" still exposes a legacy hint`).toBeUndefined();
    }
  });

  it.each(['contain-now', 'hunt-first'] as const)(
    'keeps the %s containment route reachable through evidence, the decision effect, and response commands',
    (optionId) => {
      const decisions = { 'containment-timing': optionId };
      const scope = sentinelCampaign.stages[2];
      const persistence = sentinelCampaign.stages[3];
      const containment = sentinelCampaign.stages[4];

      expect(findAdvancePath(scope, { events: sentinelCampaign.logCorpus, stageIndex: 2, decisions })).not.toBeNull();
      expect(findAdvancePath(persistence, { events: sentinelCampaign.logCorpus, stageIndex: 3, decisions })).not.toBeNull();
      expect(findAdvancePath(containment, { decisions })).not.toBeNull();
    }
  );

  it('makes early containment reveal the revoked binding and pivot to choice-visible rogue activity', () => {
    const scope = sentinelCampaign.stages[2];
    expect(scope.decision?.timing).toBe('after-stage');
    const containNow = scope.decision?.options.find((option) => option.id === 'contain-now');
    expect(containNow?.effects?.revealsFacts).toContain('revoked-primary-binding');

    const earlyEvents = (sentinelCampaign.logCorpus ?? [])
      .filter((event) => event.revealsFact?.startsWith('evidence-rogue'))
      .filter((event) => isChoiceVisible(event.visibleWhen, { 'containment-timing': 'contain-now' }));
    expect(earlyEvents.map((event) => event.id)).toEqual([
      'sig-rogue-sa-pivot',
      'sig-rogue-binding-pivot',
    ]);

    const containment = sentinelCampaign.stages[4];
    expect(
      containment.commands.some(
        (command) =>
          command.description.includes('ci-deploy-bot-binding') &&
          command.visibleWhen?.['containment-timing'] === 'contain-now'
      )
    ).toBe(false);
    expect(
      containment.objectiveSteps?.some(
        (step) =>
          step.id === 'revoke-primary-binding' &&
          step.visibleWhen?.['containment-timing'] === 'contain-now'
      )
    ).toBe(false);
  });

  it('references known facts and valid decision options from content contracts', () => {
    const knownFacts = new Set(Object.keys(sentinelCampaign.factLibrary));
    const decisions = new Map(
      sentinelCampaign.stages.flatMap((stage) =>
        stage.decision ? [[stage.decision.id, new Set(stage.decision.options.map((option) => option.id))] as const] : []
      )
    );

    for (const stage of sentinelCampaign.stages) {
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

    for (const copy of sentinelCampaign.conditionalDebrief ?? []) {
      for (const [decisionId, optionId] of Object.entries(copy.when ?? {})) {
        expect(decisions.get(decisionId)?.has(optionId), `unknown debrief choice ${decisionId}:${optionId}`).toBe(true);
      }
    }
  });
});
