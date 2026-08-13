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

test('malformed saved JSON exposes recovery without a blank route', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('operation-mango-progress', '{broken-json'));
  await page.goto('/');
  await expect(page.getByText(/saved progress could not be read/i)).toBeVisible();
  await activate(page, 'button', 'Reset Progress');
  await expect(page).toHaveURL(/campaign-select/);
  await expect(page.getByRole('heading', { name: 'Choose your side' })).toBeVisible();
});

test('reduced motion removes the focal scene animation', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await seedProgress(page, 'infiltrator', 0);
  await page.goto('/mission');
  const scene = page.getByRole('main', { name: 'Operation briefing' });
  await expect(scene).toHaveAttribute('data-motion', 'reduced');
  await expect(scene).toHaveCSS('animation-name', 'none');
});

test('covers the alternative Sentinel containment option', async ({ page }) => {
  await seedProgress(page, 'sentinel', 2, { seenBriefingIds: ['triage', 'identity', 'scope'] });
  await page.goto('/mission');
  await activate(page, 'button', 'Contain now');
  await expect(page.getByText(/Decision: Contain now/i)).toBeVisible();
  await expect(page.getByText(/Cut ci-deploy-bot off now/i)).toBeVisible();
});

test('covers the alternative Infiltrator persistence-first option', async ({ page }) => {
  await seedProgress(page, 'infiltrator', 3, { seenBriefingIds: ['recon', 'identity', 'access', 'escalation'] });
  await page.goto('/mission');
  await activate(page, 'button', 'Plant persistence first');
  await expect(page.getByText(/Decision: Plant persistence first/i)).toBeVisible();
  const terminal = page.getByLabel('terminal input');
  await terminal.pressSequentially('kubectl create s');
  await terminal.press('Tab');
  await expect(terminal).toHaveValue('kubectl create serviceaccount log-rotator -n kube-system');
});
