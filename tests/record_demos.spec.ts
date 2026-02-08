import { test, expect } from '@playwright/test';

test.describe('Feature Demos', () => {

    test('menu_general', async ({ page }) => {
        // 1. Menu General
        await page.goto('/');

        // Open Menu
        await page.getByText('Menu').click();
        await expect(page.getByText('Settings').first()).toBeVisible();

        // Hover over buttons
        await page.getByText('HISTORY >').hover();
        await page.waitForTimeout(500);
        await page.getByText('ANALYTICS >').hover();
        await page.waitForTimeout(500);

        // Change settings
        const focusInput = page.locator('input[type="number"]').first();
        await focusInput.fill('30');
        await page.waitForTimeout(500);

        const breakInput = page.locator('input[type="number"]').nth(1);
        await breakInput.fill('10');
        await page.waitForTimeout(500);

        // Toggle sound
        const soundBtn = page.locator('button:has(.lucide-volume-2)');
        if (await soundBtn.isVisible()) {
            await soundBtn.click();
            await page.waitForTimeout(500);
            await page.locator('button:has(.lucide-volume-x)').click();
        }

        await page.waitForTimeout(1000);

        // Close/Save
        await page.getByText('Save Changes').click();
        await expect(page.getByText('Settings').first()).toBeHidden();

        await page.waitForTimeout(1000);
    });

    test('theme', async ({ page }) => {
        // 2. Theme
        await page.goto('/');

        // Open Menu
        await page.getByText('Menu').click();

        // Go to Theme tab
        await page.getByText('Theme').click();
        await page.waitForTimeout(500);

        // Interact with Theme Settings
        await page.getByText('Focus Mode').first().waitFor();

        // Click a few color presets
        const colors = page.locator('button[title]');
        await colors.nth(0).click(); // Keshi Red
        await page.waitForTimeout(500);
        await colors.nth(5).click(); // Keshi Green
        await page.waitForTimeout(500);
        await colors.nth(9).click(); // Sky
        await page.waitForTimeout(500);

        // Switch to Relax Mode color settings (if applicable visuals needed)

        await page.waitForTimeout(1000);

        // Save
        await page.getByText('Save Changes').click();
        await page.waitForTimeout(1000);
    });

    test('main_page', async ({ page }) => {
        // 3. Main Page
        await page.goto('/');

        // Start timer
        await page.getByText('Start').click();
        await page.waitForTimeout(2000); // Let it run a bit

        // Hover over elements
        await page.locator('.ransom-letter').first().hover();
        await page.waitForTimeout(1000);

        // Pause
        await page.getByText('Pause').click();
        await page.waitForTimeout(1000);

        // Switch Mode
        await page.getByText('Click to Switch').click();
        await page.waitForTimeout(1000);

        // Start Break
        await page.getByText('Start').click();
        await page.waitForTimeout(2000);

        // Reset
        const resetBtn = page.locator('button:has(.lucide-rotate-ccw)');
        await resetBtn.click();
        await page.waitForTimeout(1000);
    });
});
