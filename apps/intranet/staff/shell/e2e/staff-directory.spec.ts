import { expect, test } from '@org/playwright-config/test';
import {
  expectRemoteRendered,
  openRemote,
  remotePage,
  settle,
  zone,
} from './helpers';

const remote = zone.remotes.find((r) => r.name === 'staff-directory')!;

test.describe('Staff directory', () => {
  test('search staff, open a person, follow the manager link', async ({
    page,
  }) => {
    await openRemote(page, remote);
    const container = remotePage(page, remote);
    await expect(container.getByTestId('staff-count')).toHaveText(
      '24 people found',
    );

    await container
      .getByRole('searchbox', { name: 'Search staff' })
      .fill('security');
    await expect(container.getByTestId('staff-count')).toHaveText(
      '1 person found',
    );
    await expect(page).toHaveURL(/\/staff-directory\?q=security$/);
    await container.getByRole('link', { name: 'Priya Nair' }).click();

    await expect(page).toHaveURL(/\/staff-directory\/s-1016$/);
    await expect(
      container.getByRole('heading', { level: 1, name: 'Priya Nair' }),
    ).toBeVisible();
    await expect(container.getByText('Security Engineer')).toBeVisible();
    await container.getByRole('link', { name: 'Oliver Chan' }).click();
    await expect(
      container.getByRole('heading', { level: 1, name: 'Oliver Chan' }),
    ).toBeVisible();

    // back in history: the search is still there (it lives in the URL)
    await page.goBack();
    await page.goBack();
    await expect(
      container.getByRole('searchbox', { name: 'Search staff' }),
    ).toHaveValue('security');
  });

  test('filter by department', async ({ page }) => {
    await openRemote(page, remote);
    const container = remotePage(page, remote);
    await settle(page);
    await container
      .getByRole('combobox', { name: 'Department' })
      .selectOption('Legal');
    await expect(container.getByTestId('staff-count')).toHaveText(
      '2 people found',
    );
    await expect(container.getByTestId('staff-card')).toHaveCount(2);
  });

  test('the filters live in the URL: a link reproduces the view, a reload restores it', async ({
    page,
  }) => {
    // a shared link
    await page.goto(`${remote.path}?department=Legal&q=privacy`);
    await expectRemoteRendered(page, remote);
    const container = remotePage(page, remote);
    const search = container.getByRole('searchbox', { name: 'Search staff' });
    const department = container.getByRole('combobox', { name: 'Department' });
    await expect(search).toHaveValue('privacy');
    await expect(department).toHaveValue('Legal');
    await expect(container.getByTestId('staff-count')).toHaveText(
      '1 person found',
    );
    await expect(
      container.getByRole('link', { name: 'Wei Jie Ho' }),
    ).toBeVisible();

    // change a filter: the URL follows; a reload shows the same list
    await search.fill('');
    await expect(container.getByTestId('staff-count')).toHaveText(
      '2 people found',
    );
    await expect(page).toHaveURL(/\/staff-directory\?department=Legal$/);
    await page.reload();
    await expectRemoteRendered(page, remote);
    await expect(department).toHaveValue('Legal');
    await expect(search).toHaveValue('');
    await expect(container.getByTestId('staff-count')).toHaveText(
      '2 people found',
    );
  });
});

test.describe('Staff directory, unknown person', () => {
  // The API answers 404 on purpose: allow exactly that request.
  test.use({
    allowedHttpErrors: [{ url: /\/api\/staff\/s-0000$/, status: 404 }],
  });

  test('an unknown id gets a clear page', async ({ page }) => {
    await page.goto(`${remote.path}/s-0000`);
    await expect(
      remotePage(page, remote).getByRole('heading', {
        name: 'Staff member not found',
      }),
    ).toBeVisible();
  });

  test('staff detail shows a masked NRIC and never the full number', async ({
    page,
  }) => {
    // the API response itself must not carry the full number
    const bodies: string[] = [];
    page.on('response', (response) => {
      if (/\/staff\/s-1016$/.test(response.url())) {
        void response.text().then((text) => bodies.push(text));
      }
    });
    await openRemote(page, remote, 's-1016');
    const container = remotePage(page, remote);
    await expect(
      container.getByRole('heading', { level: 1, name: 'Priya Nair' }),
    ).toBeVisible();
    const nric = container.getByTestId('staff-nric');
    await expect(nric).toHaveText(/^S\*{4}\d{3}[A-Z]$/);
    // neither the API nor the DOM has the full number
    expect(await page.content()).not.toMatch(/[STFGM]\d{7}[A-Z]/);
    await expect.poll(() => bodies.length).toBeGreaterThan(0);
    expect(bodies.join('')).toContain('"nric":"S****');
    expect(bodies.join('')).not.toMatch(/[STFGM]\d{7}[A-Z]/);
  });
});
