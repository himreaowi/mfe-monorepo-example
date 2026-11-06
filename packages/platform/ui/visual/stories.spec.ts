import fs from 'node:fs';
import path from 'node:path';
import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

type IndexEntry = {
  id: string;
  type: 'story' | 'docs';
  title: string;
  name: string;
};

const indexFile = path.join(
  import.meta.dirname,
  '..',
  'storybook-static',
  'index.json',
);
const stories = Object.values(
  (
    JSON.parse(fs.readFileSync(indexFile, 'utf8')) as {
      entries: Record<string, IndexEntry>;
    }
  ).entries,
).filter((entry) => entry.type === 'story');

const THEMES = ['light', 'dark'] as const;
/** WCAG 2.0, 2.1 and 2.2 level A + AA rules of axe-core. */
const WCAG_AA = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];
const baselineDir = path.join(
  import.meta.dirname,
  '__screenshots__',
  process.platform,
);
const hasBaselines = fs.existsSync(baselineDir);

for (const story of stories) {
  for (const theme of THEMES) {
    test(`${story.id} (${theme})`, async ({ page }, testInfo) => {
      await page.goto(
        `/iframe.html?id=${story.id}&viewMode=story&globals=theme:${theme}`,
      );
      await expect(page.locator('body')).toHaveClass(/sb-show-main/);
      await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
      await page.evaluate(() => document.fonts.ready);

      const { violations } = await new AxeBuilder({ page })
        .include('#storybook-root')
        .withTags(WCAG_AA)
        .analyze();
      expect(
        violations.map(
          (v) =>
            `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`,
        ),
      ).toEqual([]);

      // Baselines are committed per platform (see playwright.config.ts). On a platform without
      // any, only the a11y checks run unless --update-snapshots writes them.
      const writing = ['all', 'changed'].includes(
        testInfo.config.updateSnapshots,
      );
      if (!hasBaselines && !writing) {
        testInfo.annotations.push({
          type: 'skip-screenshot',
          description: `no baselines for ${process.platform}: run pnpm test:ui:update`,
        });
        return;
      }
      await expect(page).toHaveScreenshot(`${story.id}-${theme}.png`, {
        fullPage: true,
      });
    });
  }
}
