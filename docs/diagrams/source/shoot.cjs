// Render each diagram's <svg> to a 2x PNG with Playwright's Chromium.
// Usage (from the repo root): node docs/diagrams/source/shoot.cjs [html-dir] [png-dir]
// Both default to docs/diagrams. Playwright is resolved from the repo's own
// @playwright/test (devDependency of packages/playwright-config); pass PLAYWRIGHT=<module path>
// to use another copy.
const path = require('path');
const repoRoot = path.resolve(__dirname, '..', '..', '..');
const pwPath =
  process.env.PLAYWRIGHT ||
  require.resolve('@playwright/test', { paths: [path.join(repoRoot, 'packages', 'playwright-config')] });
const { chromium } = require(pwPath);
const dir = path.resolve(process.argv[2] || path.join(repoRoot, 'docs', 'diagrams'));
const out = path.resolve(process.argv[3] || dir);
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ deviceScaleFactor: 2, viewport: { width: 1400, height: 900 } });
  for (const name of ['1-runtime', '2-layers', '3-new-project']) {
    await page.goto('file://' + path.join(dir, name + '.html'));
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(500);
    await page.locator('svg').first().screenshot({ path: path.join(out, name + '.png') });
  }
  await browser.close();
  console.log('done');
})();
