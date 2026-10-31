import { expect, test } from '@playwright/test';
import { open } from './helpers';

// The details sheet must not vanish on a short or slow drag; it closes on a deliberate swipe.
test('mobile sheet needs a deliberate swipe to close', async ({ page }) => {
  await open(page);
  await page.locator('#jump').selectOption('Manchester');
  const sheet = page.locator('.sheet'); await expect(sheet).toBeVisible(); await page.waitForTimeout(700);
  const grab = (await page.locator('.grab-zone').boundingBox())!; const x = grab.x + grab.width / 2, y = grab.y + 8;
  const drag = async (dy: number, steps = 12) => { await page.mouse.move(x, y); await page.mouse.down(); for (let i = 1; i <= steps; i++) await page.mouse.move(x, y + (dy * i) / steps); await page.mouse.up(); };
  await drag(70); await page.waitForTimeout(700); await expect(sheet).toBeVisible();   // short drag springs back
  await drag(380, 30); await expect(sheet).toHaveCount(0, { timeout: 3000 });         // long drag closes
});

test('phone layout: nav fits, filters collapse, no horizontal scroll', async ({ page }) => {
  await open(page);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await expect(page.getByText('Dates and species')).toBeVisible(); await expect(page.locator('#from')).toBeHidden();
  await page.getByText('Dates and species').click(); await expect(page.locator('#from')).toBeVisible();
});
