import { test, expect } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const baseURL = process.env.DEMO_BASE_URL || 'https://pomodoro.xsmity.cloud';

test.use({
  baseURL,
  video: {
    mode: 'on',
    size: { width: 1440, height: 900 },
  },
  viewport: { width: 1440, height: 900 },
  actionTimeout: 15000,
});

async function settle(page, ms = 700) {
  await page.waitForTimeout(ms);
}

test.describe.configure({ mode: 'serial' });

test('demo_main_timer', async ({ page }) => {
  await page.goto('/');
  await page.waitForLoadState('networkidle').catch(() => {});
  await settle(page, 1200);

  // Start focus
  const start = page.getByRole('button', { name: /start/i }).first();
  if (await start.count()) {
    await start.click();
    await settle(page, 1800);
  }

  // Pause if present
  const pause = page.getByRole('button', { name: /pause/i }).first();
  if (await pause.count()) {
    await pause.click();
    await settle(page, 900);
  }

  // Switch mode if present
  const switchMode = page.getByText(/click to switch|switch/i).first();
  if (await switchMode.count()) {
    await switchMode.click();
    await settle(page, 1200);
  }

  // Start break
  const start2 = page.getByRole('button', { name: /start/i }).first();
  if (await start2.count()) {
    await start2.click();
    await settle(page, 1500);
  }

  // Reset
  const reset = page.locator('button').filter({ has: page.locator('svg.lucide-rotate-ccw, svg') }).first();
  // try aria or visible reset icons
  const resetByLabel = page.getByRole('button', { name: /reset/i });
  if (await resetByLabel.count()) await resetByLabel.first().click();
  await settle(page, 1000);
});

test('demo_theme_settings', async ({ page }) => {
  await page.goto('/');
  await settle(page, 1000);

  // Open menu / settings
  const menu = page.getByText(/^Menu$/i).first();
  if (await menu.count()) await menu.click();
  else {
    const settings = page.getByRole('button', { name: /settings|menu/i }).first();
    if (await settings.count()) await settings.click();
  }
  await settle(page, 800);

  const themeTab = page.getByText(/^Theme$/i).first();
  if (await themeTab.count()) {
    await themeTab.click();
    await settle(page, 700);
  }

  // Click a few color-like buttons if present
  const colorButtons = page.locator('button[title]');
  const n = Math.min(await colorButtons.count(), 6);
  for (let i = 0; i < n; i += 1) {
    await colorButtons.nth(i).click().catch(() => {});
    await settle(page, 450);
  }

  const save = page.getByRole('button', { name: /save/i }).first();
  if (await save.count()) {
    await save.click();
    await settle(page, 900);
  }
});

test('demo_menu_general', async ({ page }) => {
  await page.goto('/');
  await settle(page, 1000);

  const menu = page.getByText(/^Menu$/i).first();
  if (await menu.count()) await menu.click();
  await settle(page, 800);

  // hover history/analytics if present
  for (const label of ['HISTORY', 'ANALYTICS', 'History', 'Analytics']) {
    const el = page.getByText(label, { exact: false }).first();
    if (await el.count()) {
      await el.hover().catch(() => {});
      await settle(page, 400);
    }
  }

  const numberInputs = page.locator('input[type="number"]');
  if (await numberInputs.count() > 0) {
    await numberInputs.first().fill('30').catch(() => {});
    await settle(page, 400);
  }
  if (await numberInputs.count() > 1) {
    await numberInputs.nth(1).fill('10').catch(() => {});
    await settle(page, 400);
  }

  const save = page.getByRole('button', { name: /save/i }).first();
  if (await save.count()) await save.click().catch(() => {});
  await settle(page, 900);
});

test('discipline route moves to Habit Intelligence', async ({ page }) => {
  await page.route('https://habits.xsmity.cloud/**', route => route.fulfill({
    status: 200,
    contentType: 'text/html',
    body: '<title>Rhythm</title><h1>Habit Intelligence</h1>',
  }));
  await page.goto('/discipline');
  await page.waitForURL('https://habits.xsmity.cloud/**');
});
