import { test, expect } from '@playwright/test';

for (const locale of ['en', 'ar']) for (const width of [390, 1280]) for (const colorScheme of ['light', 'dark']) {
  test(`public native demo: ${locale}, ${width}px, ${colorScheme}, isolated sample outcomes`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    await page.emulateMedia({ colorScheme });
    const badRequests = [], errors = [];
    page.on('request', request => {
      const url = new URL(request.url());
      if (!['127.0.0.1', 'localhost'].includes(url.hostname) || url.pathname.startsWith('/api/')) badRequests.push(request.url());
    });
    page.on('pageerror', error => errors.push(error.message));
    await page.addInitScript(() => { localStorage.setItem('apply-directory', 'private-view'); localStorage.setItem('apply-view-uae', '{"query":"private search"}'); });
    await page.goto(`/demo/?lang=${locale}`);
    const ar = locale === 'ar';
    await expect(page.locator('html')).toHaveAttribute('dir', ar ? 'rtl' : 'ltr');
    await expect(page.getByRole('button', { name: ar ? 'طلبات التوظيف المُرسلة: 2' : 'Applications sent: 2', exact: true })).toBeVisible();
    await expect(page.locator('.company-name').first()).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    await page.getByRole('button', { name: ar ? 'ملفات مهنية أُنشئت: 3' : 'Profiles created: 3', exact: true }).click();
    await expect(page.locator('.snapshot-records li')).toHaveCount(3);
    await page.keyboard.press('Escape');
    if (width === 390 && colorScheme === 'light') {
      await page.locator('.discovery-panel summary').first().click();
      await page.getByRole('button', { name: ar ? 'مراجعة الوظائف' : 'Review jobs', exact: true }).click();
      await expect(page.locator('.discovery-jobs li')).toHaveCount(2);
      await page.locator('.discovery-job-heading button').first().click();
      await expect(page.locator('.discovery-job-detail')).toContainText(ar ? 'افتراضي' : 'fictional');
      await page.keyboard.press('Escape');
    }
    const run = page.locator('.directory-run');
    await run.click();
    await expect(page.locator('.run-action-choice input').nth(2)).not.toBeChecked();
    // Explicitly select the third simulated action so all three counters change.
    await page.locator('.run-action-choice input').nth(2).check();
    await page.locator('.run-dialog-actions button.primary').click();
    await expect(page.locator('.run-current')).toContainText(ar ? 'جارٍ العمل على' : 'Working on');
    await expect(page.locator('.run-current')).toContainText(ar ? 'اكتملت المراجعة' : 'Finished this pass', { timeout: 12000 });
    await expect(page.locator('.run-targets li')).toHaveCount(4);
    await page.keyboard.press('Escape');
    await expect(page.getByRole('button', { name: ar ? 'طلبات التوظيف المُرسلة: 4' : 'Applications sent: 4', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: ar ? 'ملفات مهنية أُنشئت: 7' : 'Profiles created: 7', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: ar ? 'رسائل البريد المُرسلة: 4' : 'Emails sent: 4', exact: true })).toBeVisible();
    await page.getByRole('button', { name: ar ? 'إعادة الضبط' : 'Reset demo', exact: true }).click();
    await expect(page.getByRole('button', { name: ar ? 'طلبات التوظيف المُرسلة: 2' : 'Applications sent: 2', exact: true })).toBeVisible();
    expect(await page.evaluate(() => localStorage.getItem('apply-directory'))).toBe('private-view');
    expect(await page.evaluate(() => localStorage.getItem('apply-view-uae'))).toBe('{"query":"private search"}');
    expect(badRequests).toEqual([]);
    expect(errors).toEqual([]);
  });
}

test('landing, Skills and guides share localized native demos with a phone full-page route', async ({ page }) => {
  for (const [path, locale] of [['/welcome/', 'en'], ['/welcome/ar/', 'ar'], ['/skills/', 'en'], ['/ar/skills/', 'ar'], ['/guides/use-the-skill/', 'en'], ['/ar/guides/use-the-skill/', 'ar']]) {
    await page.goto(path);
    const disclosure = page.locator('.native-preview-disclosure');
    if (await disclosure.count()) await disclosure.locator('summary').click();
    const frame = page.locator('.native-app-demo iframe');
    await expect(frame).toHaveAttribute('src', `/demo/?lang=${locale}&embed=1`);
    await expect(page.locator('.demo-preview-heading a')).toHaveAttribute('href', `/demo/?lang=${locale}`);
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(frame).toHaveAttribute('inert', '');
    await expect(page.locator('.demo-mobile-open')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  }
});
