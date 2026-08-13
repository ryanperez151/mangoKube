import { expect, type Page } from '@playwright/test';

export type Role = 'sentinel' | 'infiltrator';

export async function activate(page: Page, role: string, name: string | RegExp) {
  const target = page.getByRole(role as never, { name });
  await target.press('Enter');
}

export async function startRole(page: Page, role: Role) {
  await page.goto('/');
  await activate(page, 'button', 'New operation');
  await expect(page).toHaveURL(/campaign-select/);
  await activate(page, 'button', role === 'sentinel' ? 'Deploy as The Sentinel' : 'Deploy as The Infiltrator');
  await expect(page).toHaveURL(/mission/);
}

export async function beginBriefing(page: Page) {
  await expect(page.getByRole('main', { name: 'Operation briefing' })).toBeVisible();
  await activate(page, 'button', 'Begin');
}

export async function runCommand(page: Page, command: string) {
  const input = page.getByLabel('terminal input');
  await input.pressSequentially(command);
  await input.press('Enter');
}

export async function continueStage(page: Page, beginNext = true) {
  await expect(page.getByRole('main', { name: 'Stage resolution' })).toBeVisible();
  await activate(page, 'button', 'Continue operation');
  if (beginNext) await beginBriefing(page);
}

export async function pinFinding(page: Page, message: string) {
  await page.getByRole('button', { name: message, exact: true }).press('Enter');
  await page.getByRole('button', { name: 'Pin to case file' }).press('Enter');
}

type SeedOptions = {
  decisions?: Record<string, string>;
  collectedFacts?: string[];
  revealedFacts?: string[];
  seenBriefingIds?: string[];
  pendingStageResolution?: { stageId: string } | null;
  clusterStatus?: 'nominal' | 'suspicious' | 'compromised' | 'contained';
};

export async function seedProgress(page: Page, role: Role, stageIndex: number, options: SeedOptions = {}) {
  if (new URL(page.url()).origin !== 'http://127.0.0.1:43175') await page.goto('/');
  await page.evaluate(({ campaignId, index, overrides }) => {
    localStorage.setItem(
      'operation-mango-progress',
      JSON.stringify({
        version: 2,
        state: {
          campaignId,
          stageIndex: index,
          revealedFacts: overrides.revealedFacts ?? [],
          collectedFacts: overrides.collectedFacts ?? [],
          terminalHistory: [],
          clusterStatus: overrides.clusterStatus ?? 'nominal',
          highlightedNodeIds: [],
          revealedEdgeIds: [],
          pinnedEvidence: [],
          activeQuery: '',
          timeRangeId: 'last-1h',
          decisions: overrides.decisions ?? {},
          guidanceLevelByStage: {},
          failedAttemptsByStage: {},
          seenBriefingIds: overrides.seenBriefingIds ?? [],
          pendingStageResolution: overrides.pendingStageResolution ?? null,
        },
      })
    );
  }, { campaignId: role, index: stageIndex, overrides: options });
}
