import type { Page } from '@playwright/test';
import { checkA11y, expect, test, useTheme } from '@org/playwright-config/test';
import { openRemote, remotePage, settle, zone } from './helpers';

/**
 * axe (WCAG 2.2 AA) on feature states the generated a11y spec does not reach: detail pages,
 * forms with errors. Light and dark (the open header
 * menu is scanned by the generated a11y.spec.ts).
 */
const remote = (name: string) => zone.remotes.find((r) => r.name === name)!;

const targets: { name: string; open: (page: Page) => Promise<void> }[] = [
  {
    name: 'staff detail page',
    open: (page) => openRemote(page, remote('staff-directory'), 's-1016'),
  },
  {
    name: 'leave form with errors',
    open: async (page) => {
      const leave = remote('leave-requests');
      await openRemote(page, leave, 'new');
      await settle(page);
      await remotePage(page, leave)
        .getByRole('button', { name: 'Send request' })
        .click();
      await expect(page.getByTestId('error-summary')).toBeVisible();
    },
  },
  {
    name: 'helpdesk form with errors (vendor)',
    open: async (page) => {
      const helpdesk = remote('it-helpdesk');
      await openRemote(page, helpdesk, 'new');
      await page.getByRole('button', { name: 'Send ticket' }).click();
      await expect(page.getByText('There is a problem')).toBeVisible();
    },
  },
  {
    name: 'helpdesk ticket page (vendor)',
    open: (page) => openRemote(page, remote('it-helpdesk'), 'tickets/HD-1040'),
  },
];

for (const theme of ['light', 'dark'] as const) {
  test.describe(`WCAG 2.2 AA, features, ${theme} theme`, () => {
    for (const target of targets) {
      test(target.name, async ({ page }) => {
        await useTheme(page, theme);
        await target.open(page);
        await settle(page);
        await checkA11y(page);
      });
    }
  });
}
