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

test('familiarization primers pass axe WCAG 2.2 AA', async ({ page }) => {
  await seedProgress(page, 'sentinel', 0, { seenPrimerIds: [] });
  await page.goto('/primer');
  await expect(page.getByRole('main', { name: 'Familiarization primer' })).toBeVisible();
  await expectWcag22AA(page, 'Sentinel primer');

  await page.evaluate(() => localStorage.clear());
  await seedProgress(page, 'infiltrator', 0, { seenPrimerIds: [] });
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Your toolkit' })).toBeVisible();
  await expectWcag22AA(page, 'Infiltrator primer');
});

test('guidance tab passes axe WCAG 2.2 AA with every tier revealed', async ({ page }) => {
  await seedProgress(page, 'sentinel', 0, { seenBriefingIds: ['triage'] });
  await page.goto('/mission');
  await activate(page, 'button', 'Help');
  for (const label of ['Reveal a hint', 'Reveal the next hint', 'Reveal the next hint']) {
    await activate(page, 'button', label);
  }
  await expect(page.getByTestId('guidance-tier-3')).toBeVisible();
  await expectWcag22AA(page, 'guidance tab');
});

test('decision scene passes axe WCAG 2.2 AA', async ({ page }) => {
  await seedProgress(page, 'sentinel', 2, {
    collectedFacts: ['evidence-secret-read', 'evidence-exfil-egress'],
    revealedFacts: ['evidence-secret-read', 'evidence-exfil-egress'],
    seenBriefingIds: ['scope'],
    pendingStageResolution: { stageId: 'scope' },
  });
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

test('field browser passes axe WCAG 2.2 AA, open and pinned', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await seedProgress(page, 'sentinel', 0, { seenBriefingIds: ['triage'] });
  await page.goto('/mission');
  await expect(page.getByRole('main', { name: 'Mission workspace' })).toBeVisible();
  await expect(page.getByText(/could not be read|was repaired/i)).toHaveCount(0);

  await activate(page, 'button', 'Open field browser');
  await expect(page.getByTestId('field-panel')).toBeVisible();
  await expectWcag22AA(page, 'field browser open');

  await activate(page, 'button', 'Pin field browser');
  await expect(page.getByTestId('field-panel')).toBeVisible();
  await expectWcag22AA(page, 'field browser pinned');

  const overflow = await page.evaluate(() => ({
    htmlX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    bodyX: document.body.scrollWidth - document.body.clientWidth,
  }));
  expect(overflow).toEqual({ htmlX: 0, bodyX: 0 });
});
