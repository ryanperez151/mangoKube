import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { activate, seedProgress } from './helpers';

async function expectWcag22AA(page: Page, state: string) {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze();
  expect(results.violations, `${state}: ${JSON.stringify(results.violations, null, 2)}`).toEqual([]);
}

test('landing and campaign selection pass axe WCAG 2.2 AA', async ({ page }) => {
  await page.goto('/');
  await expectWcag22AA(page, 'landing');
  await activate(page, 'button', 'New operation');
  await expect(page.getByRole('heading', { name: 'Choose your side' })).toBeVisible();
  await expectWcag22AA(page, 'campaign selection');
});

test('Sentinel and Infiltrator workspaces pass axe WCAG 2.2 AA', async ({ page }) => {
  await seedProgress(page, 'sentinel', 0, { seenBriefingIds: ['triage'] });
  await page.goto('/mission');
  await expect(page.getByRole('main', { name: 'Mission workspace' })).toBeVisible();
  await expectWcag22AA(page, 'Sentinel workspace');

  await page.evaluate(() => localStorage.clear());
  await seedProgress(page, 'infiltrator', 0, { seenBriefingIds: ['recon'] });
  await page.reload();
  await expect(page.getByText('Infiltrator')).toBeVisible();
  await expectWcag22AA(page, 'Infiltrator workspace');
});

test('decision scene passes axe WCAG 2.2 AA', async ({ page }) => {
  await seedProgress(page, 'sentinel', 2, { seenBriefingIds: ['scope'] });
  await page.goto('/mission');
  await expect(page.getByRole('main', { name: 'Mission decision' })).toBeVisible();
  await expectWcag22AA(page, 'decision');
});

test('resolution scene passes axe WCAG 2.2 AA', async ({ page }) => {
  await seedProgress(page, 'sentinel', 0, {
    collectedFacts: ['evidence-interactive-shell', 'evidence-offhours-exec'],
    revealedFacts: ['evidence-interactive-shell', 'evidence-offhours-exec'],
    seenBriefingIds: ['triage'],
    pendingStageResolution: { stageId: 'triage' },
  });
  await page.goto('/mission');
  await expect(page.getByRole('main', { name: 'Stage resolution' })).toBeVisible();
  await expectWcag22AA(page, 'resolution');
});

test('debrief scene passes axe WCAG 2.2 AA', async ({ page }) => {
  await seedProgress(page, 'sentinel', 5, {
    decisions: { 'containment-timing': 'hunt-first' },
    clusterStatus: 'contained',
  });
  await page.goto('/debrief');
  await expect(page.getByRole('main', { name: 'Operation outcome debrief' })).toBeVisible();
  await expectWcag22AA(page, 'debrief');
});
