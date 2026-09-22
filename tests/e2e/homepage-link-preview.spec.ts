import { test, expect } from '@playwright/test';
import { readFileSync, readdirSync } from 'node:fs';

const imagePath = '/homepage-social-preview-v1.png';
const imageUrl = `https://takeaseatwith.com${imagePath}`;

test('shared homepage serves its hero preview before JavaScript and after refresh', async ({ browser, request }) => {
  // Allow this public journey to run independently against the isolated local D1.
  const tables = await request.post('/e2e-control', { data: { sql: "SELECT name FROM sqlite_master WHERE name='customer_bookings'" } });
  expect(tables.ok()).toBeTruthy();
  if (!(await tables.json()).results.length) {
    for (const file of readdirSync('drizzle').filter(name => name.endsWith('.sql')).sort()) {
      for (const sql of readFileSync(`drizzle/${file}`, 'utf8').split('--> statement-breakpoint').flatMap(part => part.split(';')).filter(part => part.trim())) {
        const result = await request.post('/e2e-control', { data: { sql } });
        expect(result.ok(), await result.text()).toBeTruthy();
      }
    }
  }
  const response = await request.get('/');
  expect(response.ok()).toBeTruthy();
  const html = await response.text();
  expect(html).toContain(`property="og:image" content="${imageUrl}"`);
  expect(html).toContain(`name="twitter:image" content="${imageUrl}"`);
  expect(html).not.toContain('content="https://takeaseatwith.com/og.png"');
  const image = await request.get(imagePath);
  expect(image.ok()).toBeTruthy();
  expect(image.headers()['content-type']).toContain('image/png');
  const png = await image.body();
  expect(png.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
  expect(png.readUInt32BE(16)).toBe(1200);
  expect(png.readUInt32BE(20)).toBe(630);

  for (const viewport of [{ width: 1200, height: 630 }, { width: 390, height: 844 }]) {
    const context = await browser.newContext({ viewport });
    const page = await context.newPage();
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    page.on('response', result => { if (result.status() >= 400) errors.push(`${result.status()} ${result.url()}`); });
    page.on('requestfailed', failed => { if (!failed.failure()?.errorText.includes('ERR_ABORTED')) errors.push(failed.url()); });
    await page.goto('/', { waitUntil: 'networkidle' });
    await expect(page.locator('meta[property="og:image"]')).toHaveAttribute('content', imageUrl);
    await page.reload({ waitUntil: 'networkidle' });
    await expect(page.getByRole('heading', { name: 'Meet Your Personal Styling Committee' })).toBeVisible();
    await expect(page.locator('meta[name="twitter:image"]')).toHaveAttribute('content', imageUrl);
    await page.locator('.hero-image').evaluate((img: HTMLImageElement) => img.decode());
    await page.screenshot({ caret: 'initial', path: `.wrangler/homepage-preview-${viewport.width}.png` });
    if (viewport.width < 600) {
      const toggle=page.getByRole('button',{name:'Open navigation',exact:true});
      await toggle.click(); await expect(toggle).toHaveAttribute('aria-expanded','true');
      await expect(page.getByRole('navigation',{name:'Primary navigation'})).toBeVisible();
      await expect(toggle).toHaveAttribute('aria-controls','home-primary-navigation');
      await toggle.click(); await expect(toggle).toHaveAttribute('aria-expanded','false');
    }
    await page.locator('.hero-cta').click();
    await expect(page).toHaveURL(/\/take-a-seat\??$/);
    expect(errors).toEqual([]);
    await context.close();
  }
});
