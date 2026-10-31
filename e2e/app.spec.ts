import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { open } from './helpers';

test('map shows a label for every place and highlights the selected one', async ({ page }) => {
  await open(page);
  await expect(page.locator('.city-label')).toHaveCount(14);
  await page.getByRole('button', { name: /^Leeds, .*Open details/ }).click();
  await expect(page.locator('.city-label.on')).toContainText('Leeds');
  await expect(page.getByRole('complementary', { name: /Sightings in Leeds/ })).toBeVisible();
  await expect(page.locator('.sheet .lvl').first()).toContainText('Recent activity');
});

test('insights tooltip stays inside its card and charts have a table alternative', async ({ page }) => {
  await open(page, '#/insights');
  const card = page.locator('section', { has: page.locator('#tr') }); const box = (await card.locator('svg').first().boundingBox())!;
  for (let f = 0.05; f < 1; f += 0.07) {
    await page.mouse.move(box.x + box.width * f, box.y + box.height / 2); await page.waitForTimeout(60);
    const tip = await card.locator('.tip').boundingBox(), c = (await card.boundingBox())!;
    if (tip) { expect(tip.y).toBeGreaterThanOrEqual(c.y); expect(tip.x + tip.width).toBeLessThanOrEqual(c.x + c.width + 1); }
  }
  await card.getByText('View data as a table').click();
  expect(await card.locator('tbody tr').count()).toBeGreaterThan(10);
});

test('learn: cards expand, and the tips slideshow works by button, dot and key', async ({ page }) => {
  await open(page, '#/learn');
  await page.locator('.sp-card').first().click();
  await expect(page.getByRole('dialog')).toContainText('Fox/badger tick');
  await page.keyboard.press('Escape'); await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('button', { name: 'Next tip' }).click(); await expect(page.locator('.show p.sr-only')).toHaveText(/Use your fingers too/);
  await page.getByRole('button', { name: 'Tip 7' }).click(); await expect(page.locator('.show p.sr-only')).toHaveText(/Remove it promptly/);
  await page.locator('.show').focus(); await page.keyboard.press('ArrowRight'); await expect(page.locator('.show p.sr-only')).toHaveText(/Note the date/);
});

test('report: validates, then saves a sighting with a photo', async ({ page }) => {
  await open(page, '#/report');
  await page.getByRole('button', { name: 'Submit sighting' }).click();
  await expect(page.locator('[aria-live=assertive]').first()).not.toBeEmpty();
  await page.getByRole('radio', { name: 'Fox/badger tick' }).check({ force: true }); await page.locator('#f-location').selectOption('Leeds');
  await page.locator('#f-image').setInputFiles({ name: 't.png', mimeType: 'image/png', buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64') });
  await page.getByRole('button', { name: 'Submit sighting' }).click();
  await expect(page.getByRole('heading', { name: /Sighting saved/ })).toBeVisible();
});

test('pages are linked: map to insights to map with a species filter', async ({ page }) => {
  await open(page);
  await page.locator('#jump').selectOption('Manchester'); await page.getByRole('button', { name: 'View insights' }).click();
  await expect(page.locator('#ins-loc')).toHaveValue('Manchester');
  await page.locator('.barlist .linkbtn').first().click();
  await expect(page.locator('.chip[aria-pressed=true]')).toHaveCount(1);
});

test('settings, shortcuts and navigation behave', async ({ page }) => {
  await open(page);
  await page.keyboard.press('2'); await expect(page).toHaveTitle(/Insights/);
  await page.keyboard.press('?'); await expect(page.getByRole('dialog', { name: 'How to use this site' })).toBeVisible(); await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Display and accessibility settings' }).click();
  const before = await page.evaluate(() => parseFloat(getComputedStyle(document.body).fontSize));
  const panel = page.getByRole('dialog', { name: 'Display and accessibility settings' });
  await panel.getByRole('button', { name: 'Largest', exact: true }).click();
  expect(await page.evaluate(() => parseFloat(getComputedStyle(document.body).fontSize))).toBeGreaterThan(before * 1.2);
  await panel.getByRole('button', { name: 'High', exact: true }).click(); await expect(page.locator('html')).toHaveAttribute('data-contrast', 'high');
});

test('inclusive options: easy reading, colour-blind palette, skip intro, CSV, offline notice', async ({ page, context }) => {
  await open(page);
  await page.getByRole('button', { name: 'Display and accessibility settings' }).click();
  const panel = page.getByRole('dialog', { name: 'Display and accessibility settings' });
  await panel.getByRole('button', { name: 'Easy to read' }).click(); await expect(page.locator('html')).toHaveAttribute('data-readable', 'on');
  await panel.getByRole('button', { name: 'Colour-blind safe' }).click();
  await panel.getByRole('button', { name: 'Always skip' }).click();
  await page.keyboard.press('Escape');
  await page.evaluate(() => { location.hash = '#/insights'; }); await page.waitForTimeout(1200);
  const href = await page.getByRole('link', { name: /Download these sightings/ }).getAttribute('href');
  const csv = await page.request.get(href!); expect(csv.ok()).toBe(true); expect((await csv.text()).startsWith('id,date,location,species')).toBe(true);
  await context.setOffline(true); await expect(page.getByText(/You are offline/)).toBeVisible(); await context.setOffline(false);
  await page.goto('/'); await page.waitForTimeout(1200);
  await expect(page.locator('.intro')).toHaveCount(0); await expect(page.locator('html')).toHaveAttribute('data-readable', 'on');
});

for (const scheme of ['light', 'dark'] as const) {
  test(`no automated accessibility violations (${scheme})`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: scheme }); await open(page);
    for (const view of ['map', 'insights', 'learn', 'report']) {
      await page.evaluate((v) => { location.hash = `#/${v}`; }, view); await page.waitForTimeout(1400);
      const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
      expect(r.violations.map((v) => `${view}: ${v.id}`), JSON.stringify(r.violations.map((v) => v.nodes[0].target))).toEqual([]);
    }
  });
}
