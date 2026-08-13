import { expect, test } from '@playwright/test';
import {
  activate,
  beginBriefing,
  continueStage,
  pinFinding,
  runCommand,
  seedProgress,
  startRole,
} from './helpers';

test('keyboard-completes the Infiltrator campaign through the visible UI', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      get: () => { throw new DOMException('denied', 'SecurityError'); },
    });
  });
  await startRole(page, 'infiltrator');
  await expect(page.getByText(/continue in this tab/i)).toBeVisible();
  await beginBriefing(page);

  const warningBox = await page.getByText(/continue in this tab/i).locator('..').boundingBox();
  const actionsBox = await page.getByRole('navigation', { name: 'Mission actions' }).boundingBox();
  expect(warningBox).not.toBeNull();
  expect(actionsBox).not.toBeNull();
  expect(
    warningBox!.x < actionsBox!.x + actionsBox!.width &&
      warningBox!.x + warningBox!.width > actionsBox!.x &&
      warningBox!.y < actionsBox!.y + actionsBox!.height &&
      warningBox!.y + warningBox!.height > actionsBox!.y
  ).toBe(false);

  const missionBox = await page.getByTestId('mission-workspace').boundingBox();
  const terminalBox = await page.getByLabel('terminal input').boundingBox();
  const viewport = page.viewportSize();
  const overflow = await page.evaluate(() => ({
    htmlX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    htmlY: document.documentElement.scrollHeight - document.documentElement.clientHeight,
    bodyX: document.body.scrollWidth - document.body.clientWidth,
    bodyY: document.body.scrollHeight - document.body.clientHeight,
  }));
  expect(overflow).toEqual({ htmlX: 0, htmlY: 0, bodyX: 0, bodyY: 0 });
  expect(missionBox).not.toBeNull();
  expect(terminalBox).not.toBeNull();
  expect(viewport).not.toBeNull();
  expect(missionBox!.y + missionBox!.height).toBeLessThanOrEqual(viewport!.height);
  expect(terminalBox!.y + terminalBox!.height).toBeLessThanOrEqual(viewport!.height);
  await expect(page.getByLabel('terminal input')).toBeVisible();

  await activate(page, 'button', 'Help');
  await page.keyboard.press('Escape');
  const objectives = page.getByRole('tab', { name: 'Objectives' });
  await objectives.focus();
  await objectives.press('ArrowRight');
  await expect(page.getByRole('tab', { name: 'Cluster' })).toHaveAttribute('aria-selected', 'true');
  await page.getByRole('tab', { name: 'Cluster' }).press('ArrowLeft');

  for (const command of [
    'kubectl get pods',
    'kubectl auth can-i --list',
    'cat /var/run/secrets/kubernetes.io/serviceaccount/token',
  ]) await runCommand(page, command);
  await continueStage(page);

  for (const command of [
    'kubectl get serviceaccount ci-deploy-bot -o yaml',
    'kubectl get clusterrolebindings',
    'kubectl describe clusterrole cluster-admin',
  ]) await runCommand(page, command);
  await continueStage(page);

  for (const command of [
    'kubectl config set-credentials attacker --token=stolen-token',
    'kubectl get secrets -A',
    'kubectl auth can-i delete nodes',
  ]) await runCommand(page, command);
  await continueStage(page, false);

  await activate(page, 'button', 'Exfiltrate first');
  await beginBriefing(page);
  for (const command of [
    "kubectl get secret ultra-mango-genome-db -o jsonpath='{.data}' | base64 -d",
    'kubectl create serviceaccount log-rotator -n kube-system',
    'kubectl create clusterrolebinding log-rotator-admin --clusterrole=cluster-admin --serviceaccount=kube-system:log-rotator',
  ]) await runCommand(page, command);
  await continueStage(page);

  await runCommand(page, 'kubectl delete pod ci-deploy-bot-7f9c4d6b6-x2k1p --grace-period=0 --force');
  await runCommand(page, 'echo "handoff complete"');
  await continueStage(page, false);

  await expect(page).toHaveURL(/debrief/);
  await expect(page.getByRole('heading', { name: 'Mission accomplished' })).toBeVisible();
  await expect(page.getByText(/before securing the quieter foothold/i)).toBeVisible();
  await expect(page.getByText(/continue in this tab/i)).toBeVisible();
});

test('keyboard-completes the Sentinel campaign through the visible UI', async ({ page }) => {
  await startRole(page, 'sentinel');
  await beginBriefing(page);

  await activate(page, 'button', 'Help');
  await page.keyboard.press('Escape');
  const evidence = page.getByRole('tab', { name: 'Evidence' });
  await evidence.focus();
  await evidence.press('ArrowRight');
  await expect(page.getByRole('tab', { name: 'Attack Path' })).toHaveAttribute('aria-selected', 'true');
  await page.getByRole('tab', { name: 'Attack Path' }).press('ArrowLeft');

  await pinFinding(page, 'Interactive shell /bin/sh spawned in container');
  await pinFinding(page, 'create pods/exec');
  await continueStage(page);

  const timeRange = page.getByLabel('time range');
  await timeRange.focus();
  await timeRange.press('End');
  await timeRange.press('Enter');
  await pinFinding(page, 'list secrets across all namespaces');
  await pinFinding(page, 'authorization allowed by ClusterRoleBinding ci-deploy-bot-binding');
  await pinFinding(page, 'create clusterrolebindings/ci-deploy-bot-binding');
  await continueStage(page);

  await pinFinding(page, 'get secrets/ultra-mango-genome-db');
  await pinFinding(page, 'Outbound connection to unrecognized external host');
  await expect(page.getByRole('main', { name: 'Mission decision' })).toBeVisible();
  await activate(page, 'button', 'Hunt persistence');
  await continueStage(page);

  await pinFinding(page, 'create serviceaccounts/log-rotator');
  await pinFinding(page, 'create clusterrolebindings/log-rotator-admin');
  await continueStage(page);

  for (const command of [
    'kubectl delete clusterrolebinding ci-deploy-bot-binding',
    'kubectl delete clusterrolebinding log-rotator-admin',
    'kubectl delete serviceaccount log-rotator -n kube-system',
    'kubectl delete pod ci-deploy-bot-7f9c4d6b6-x2k1p -n build',
    'kubectl delete secret ultra-mango-genome-db -n product',
  ]) await runCommand(page, command);
  await continueStage(page, false);

  await expect(page).toHaveURL(/debrief/);
  await expect(page.getByRole('heading', { name: 'Incident contained' })).toBeVisible();
  await expect(page.getByText(/evidence-first route preserved/i)).toBeVisible();
});

test('completes the contain-now Sentinel route through every remaining resolution', async ({ page }) => {
  await seedProgress(page, 'sentinel', 2, {
    collectedFacts: ['evidence-secret-read', 'evidence-exfil-egress'],
    revealedFacts: ['evidence-secret-read', 'evidence-exfil-egress'],
    seenBriefingIds: ['triage', 'identity', 'scope'],
    pendingStageResolution: { stageId: 'scope' },
  });
  await page.goto('/mission');

  await activate(page, 'button', 'Contain now');
  await expect(page.getByRole('main', { name: 'Stage resolution' })).toBeVisible();
  await expect(page.getByText(/revoke the primary binding/i)).toBeVisible();
  await activate(page, 'button', 'Continue operation');
  await expect(page.getByText(/attacker pivots/i)).toBeVisible();
  await beginBriefing(page);

  await pinFinding(page, 'create serviceaccounts/metrics-reconciler');
  await pinFinding(page, 'create clusterrolebindings/metrics-reconciler-admin');
  await continueStage(page);

  for (const command of [
    'kubectl delete clusterrolebinding metrics-reconciler-admin',
    'kubectl delete serviceaccount metrics-reconciler -n kube-system',
    'kubectl delete pod ci-deploy-bot-7f9c4d6b6-x2k1p -n build',
    'kubectl delete secret ultra-mango-genome-db -n product',
  ]) await runCommand(page, command);
  await continueStage(page, false);

  await expect(page).toHaveURL(/debrief/);
  await expect(page.getByRole('heading', { name: 'Incident contained' })).toBeVisible();
  await expect(page.getByText(/fast revoke forced the attacker to pivot/i)).toBeVisible();
});

test('completes the persistence-first Infiltrator route through every remaining resolution', async ({ page }) => {
  await seedProgress(page, 'infiltrator', 3, {
    seenBriefingIds: ['recon', 'discovery', 'access'],
  });
  await page.goto('/mission');

  await activate(page, 'button', 'Plant persistence first');
  await expect(page.getByText(/plant the quiet identity first/i)).toBeVisible();
  await beginBriefing(page);
  for (const command of [
    'kubectl create serviceaccount log-rotator -n kube-system',
    'kubectl create clusterrolebinding log-rotator-admin --clusterrole=cluster-admin --serviceaccount=kube-system:log-rotator',
    "kubectl get secret ultra-mango-genome-db -o jsonpath='{.data}' | base64 -d",
  ]) await runCommand(page, command);
  await continueStage(page);

  await runCommand(page, 'kubectl delete pod ci-deploy-bot-7f9c4d6b6-x2k1p --grace-period=0 --force');
  await runCommand(page, 'echo "handoff complete"');
  await continueStage(page, false);

  await expect(page).toHaveURL(/debrief/);
  await expect(page.getByRole('heading', { name: 'Mission accomplished' })).toBeVisible();
  await expect(page.getByText(/planted log-rotator before the theft/i)).toBeVisible();
});
