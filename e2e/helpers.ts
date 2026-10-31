import type { Page } from '@playwright/test';
/** Open the app, skip the intro and wait for the dashboard. Map tiles are blocked so tests never depend on the network. */
export async function open(page: Page, hash = '') {
  await page.route('**/tile.openstreetmap.org/**', (r) => r.abort());
  await page.goto('/' + hash);
  await page.getByRole('button', { name: 'Skip intro' }).click();
  await page.locator('.intro').waitFor({ state: 'detached' });
  await page.waitForTimeout(800);
}
