import { expect, test } from '@playwright/test';

test.describe('Phase 0 smoke', () => {
  test('unauthenticated visitors land on the sign-in screen', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('button', { name: /continue with google/i })).toBeVisible();
  });

  test('unknown routes render the 404 page', async ({ page }) => {
    await page.goto('/does-not-exist');
    await expect(page.getByRole('heading', { name: /page not found/i })).toBeVisible();
  });

  test('theme toggle switches to dark mode', async ({ page }) => {
    await page.goto('/sign-in');
    await page.getByRole('radio', { name: 'dark theme' }).click();
    await expect(page.locator('html')).toHaveClass(/dark/);
  });
});

test.describe('Phase 1 routing', () => {
  test('onboarding routes require authentication', async ({ page }) => {
    for (const path of ['/onboarding', '/onboarding/create-academy', '/onboarding/join-academy']) {
      await page.goto(path);
      await expect(page.getByRole('button', { name: /continue with google/i })).toBeVisible();
    }
  });

  test('academy-scoped routes require authentication', async ({ page }) => {
    for (const path of ['/dashboard', '/members', '/profile']) {
      await page.goto(path);
      await expect(page.getByRole('button', { name: /continue with google/i })).toBeVisible();
    }
  });
});
