import { expect, test } from '@org/playwright-config/test';
import { remotePage, signInWithMock, signOut, zone } from './helpers';

const remote = zone.remotes.find((r) => r.name === 'my-profile')!;

test.describe('My profile (private)', () => {
  test.skip(
    !zone.authMock,
    'needs "auth": { "mock": true } (the shell\'s package.json mfe.devManifest → mfe-manifest.dev.json)',
  );

  test('sign in → my profile → save notification choices (CSRF)', async ({
    page,
  }) => {
    await page.goto(remote.path);
    await expect(page.getByTestId('sign-in-prompt')).toBeVisible();
    await expect(page.getByTestId('profile-details')).toHaveCount(0);

    await signInWithMock(page);
    const container = remotePage(page, remote);
    await expect(
      container.getByRole('heading', { level: 1, name: 'My profile' }),
    ).toBeVisible();
    await expect(
      container.getByText('Signed in as Dev User (mock).'),
    ).toBeVisible();
    await expect(container.getByTestId('profile-details')).toContainText(
      'dev.user@example.org',
    );

    const sms = container.getByRole('checkbox', {
      name: /Send me SMS reminders/,
    });
    // idempotent (desktop and mobile run in parallel against the same mock API)
    await sms.setChecked(true);
    await container.getByRole('button', { name: 'Save choices' }).click();
    await expect(container.getByTestId('preferences-status')).toHaveText(
      'Your choices are saved.',
    );
    await page.reload();
    await expect(
      remotePage(page, remote).getByRole('checkbox', {
        name: /Send me SMS reminders/,
      }),
    ).toBeChecked();

    // the home page greets the signed-in user; signing out closes the profile again
    await page.goto('/');
    await expect(page.getByTestId('welcome-user')).toHaveText(
      'Welcome back, Dev User (mock).',
    );
    await signOut(page); // user menu: in the header panel (behind "Menu" at 375 px)
    await page.goto(remote.path);
    await expect(page.getByTestId('sign-in-prompt')).toBeVisible();
  });
});
