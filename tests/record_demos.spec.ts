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

test('demo_discipline_dashboard', async ({ page }) => {
  await page.goto('/');
  await settle(page, 1000);

  // Open account / discipline entry points
  const disciplineNav = page.getByRole('button', { name: /discipline/i }).or(page.getByText(/discipline/i));
  // try account menu first
  const account = page.locator('button').filter({ hasText: /account|profile/i }).first();
  if (await account.count()) {
    await account.click().catch(() => {});
    await settle(page, 500);
  }

  // Direct navigation path if app supports hash/route; else click any Discipline control
  const openDisc = page.getByText(/discipline dashboard|discipline/i).first();
  if (await openDisc.count()) {
    await openDisc.click().catch(() => {});
  } else {
    // try sidebar or top nav
    await page.goto(baseURL.replace(/\/$/, '') + '/#discipline').catch(() => {});
  }
  await settle(page, 1500);

  // Wait for discipline chrome if present
  const range7 = page.getByRole('button', { name: /7d|7 day/i }).first();
  const range30 = page.getByRole('button', { name: /30d|30 day/i }).first();
  if (await range7.count()) {
    await range7.click();
    await settle(page, 800);
  }
  if (await range30.count()) {
    await range30.click();
    await settle(page, 1000);
  }
  if (await range7.count()) {
    await range7.click();
    await settle(page, 800);
  }

  // Switch habit matrix views
  for (const name of ['Grid', 'Lanes', 'Weeks', 'Rank']) {
    const btn = page.getByRole('button', { name: new RegExp(`^${name}$`, 'i') }).first();
    if (await btn.count()) {
      await btn.click().catch(() => {});
      await settle(page, 900);
    }
  }

  // Focus matrix views
  for (const name of ['Hours', 'Days', 'Rank']) {
    const btn = page.getByRole('button', { name: new RegExp(`^${name}$`, 'i') }).first();
    if (await btn.count()) {
      await btn.click().catch(() => {});
      await settle(page, 800);
    }
  }

  // Open evidence / habits if chrome buttons exist
  const evidence = page.getByRole('button', { name: /evidence/i }).first();
  if (await evidence.count()) {
    await evidence.click().catch(() => {});
    await settle(page, 1000);
  }
  const habits = page.getByRole('button', { name: /habits|manage habits/i }).first();
  if (await habits.count()) {
    await habits.click().catch(() => {});
    await settle(page, 1200);
  }

  // Scroll matrix into view for capture density
  await page.evaluate(() => window.scrollBy(0, 500));
  await settle(page, 900);
  await page.evaluate(() => window.scrollBy(0, 700));
  await settle(page, 900);
});
