import { expect, test } from '@playwright/test';
import { activate, seedProgress } from './helpers';

test.describe('responsive acceptance', () => {
  test('gates gameplay at 1023px without mounting controls', async ({ page }) => {
    await page.setViewportSize({ width: 1023, height: 768 });
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Larger screen required' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'New operation' })).toHaveCount(0);
  });

  for (const viewport of [
    { width: 1024, height: 768 },
    { width: 1280, height: 720 },
    { width: 1600, height: 900 },
  ]) {
    test(`supports ${viewport.width}x${viewport.height}`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await page.goto('/');
      await expect(page.getByRole('heading', { name: /One cluster/i })).toBeVisible();
      await expect(page.getByText('Larger screen required')).toHaveCount(0);
    });
  }

  for (const viewport of [
    { width: 1024, height: 768 },
    { width: 1280, height: 720 },
  ]) {
    test(`mission has no document overflow at ${viewport.width}x${viewport.height}`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await seedProgress(page, 'infiltrator', 0, { seenBriefingIds: ['recon'] });
      await page.goto('/mission');
      await expect(page.getByRole('main', { name: 'Mission workspace' })).toBeVisible();
      const dimensions = await page.evaluate(() => ({
        x: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        y: document.documentElement.scrollHeight - document.documentElement.clientHeight,
        bodyX: document.body.scrollWidth - document.body.clientWidth,
        bodyY: document.body.scrollHeight - document.body.clientHeight,
      }));
      expect(dimensions).toEqual({ x: 0, y: 0, bodyX: 0, bodyY: 0 });
    });
  }
});

test('landing supports no-save and resumable flows', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('Awaiting assignment')).toBeVisible();
  await activate(page, 'button', 'New operation');
  await activate(page, 'button', 'Deploy as The Infiltrator');
  await activate(page, 'button', 'Begin');
  const terminal = page.getByLabel('terminal input');
  await terminal.pressSequentially('kubectl get pods');
  await terminal.press('Enter');
  await page.goto('/');
  await expect(page.getByText('Session recovered')).toBeVisible();
  await page.reload();
  await activate(page, 'button', 'Continue operation');
  await expect(page.getByRole('group', { name: 'Command 1: kubectl get pods' })).toBeVisible();
});

test('direct campaign selection confirms replacement and cancellation preserves the save', async ({ page }) => {
  await seedProgress(page, 'sentinel', 2, { seenBriefingIds: ['triage', 'identity', 'scope'] });
  await page.goto('/campaign-select');

  page.once('dialog', async (dialog) => {
    expect(dialog.type()).toBe('confirm');
    expect(dialog.message()).toMatch(/replace.*progress/i);
    await dialog.dismiss();
  });
  await activate(page, 'button', 'Deploy as The Infiltrator');
  await expect(page).toHaveURL(/campaign-select/);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('operation-mango-progress')!).state.campaignId)).toBe('sentinel');

  page.once('dialog', async (dialog) => dialog.accept());
  await activate(page, 'button', 'Deploy as The Infiltrator');
  await expect(page).toHaveURL(/mission/);
  await expect(page.getByRole('main', { name: 'Operation briefing' })).toBeVisible();
});

test('malformed saved JSON exposes recovery without a blank route', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('operation-mango-progress', '{broken-json'));
  await page.goto('/');
  await expect(page.getByText(/saved progress could not be read/i)).toBeVisible();
  await activate(page, 'button', 'Reset Progress');
  await expect(page).toHaveURL(/campaign-select/);
  await expect(page.getByRole('heading', { name: 'Choose your side' })).toBeVisible();
});

test('raw persistence envelope matrix distinguishes absence, corruption, and canonical reset', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.removeItem('operation-mango-progress'));
  await page.reload();
  await expect(page.getByText('Awaiting assignment')).toBeVisible();
  await expect(page.getByRole('status')).toHaveCount(0);

  const corruptRawValues = [
    'null',
    '[]',
    '42',
    '{}',
    JSON.stringify({ state: null, version: 2 }),
    JSON.stringify({ state: { campaignId: null, stageIndex: 3 }, version: 2 }),
  ];
  for (const raw of corruptRawValues) {
    await page.evaluate((value) => localStorage.setItem('operation-mango-progress', value), raw);
    await page.reload();
    await expect(page.getByText(/saved progress could not be read/i)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Reset Progress' })).toBeVisible();
  }

  await page.evaluate(() => localStorage.setItem('operation-mango-progress', JSON.stringify({
    state: {
      campaignId: null,
      stageIndex: 0,
      revealedFacts: [],
      collectedFacts: [],
      terminalHistory: [],
      clusterStatus: 'nominal',
      highlightedNodeIds: [],
      revealedEdgeIds: [],
      pinnedEvidence: [],
      activeQuery: '',
      timeRangeId: 'last-1h',
      decisions: {},
      guidanceLevelByStage: {},
      failedAttemptsByStage: {},
      seenBriefingIds: [],
      pendingStageResolution: null,
    },
    version: 2,
  })));
  await page.reload();
  await expect(page.getByText('Awaiting assignment')).toBeVisible();
  await expect(page.getByRole('status')).toHaveCount(0);
});

test('reduced motion removes the focal scene animation', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await seedProgress(page, 'infiltrator', 0);
  await page.goto('/mission');
  const scene = page.getByRole('main', { name: 'Operation briefing' });
  await expect(scene).toHaveAttribute('data-motion', 'reduced');
  await expect(scene).toHaveCSS('animation-name', 'none');
});
