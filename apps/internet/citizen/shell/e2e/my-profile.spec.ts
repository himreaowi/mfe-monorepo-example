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
    await page.goto(zone.home);
    await expect(page.getByTestId('welcome-user')).toHaveText(
      'Welcome back, Dev User (mock).',
    );
    await signOut(page); // user menu: in the header panel (behind "Menu" at 375 px)
    await page.goto(remote.path);
    await expect(page.getByTestId('sign-in-prompt')).toBeVisible();
  });
});

test.describe('My profile: the cache belongs to the signed-in user', () => {
  test.skip(
    !zone.authMock,
    'needs "auth": { "mock": true } (the shell\'s package.json mfe.devManifest → mfe-manifest.dev.json)',
  );

  // FIXME (template gap, reported): signing out unmounts the private remote, so its
  // QueryProvider never sees `user` become null; signing in as the SAME user keeps the remote's
  // module-level cache (fresh for 30 s), so no new request is made. Another user id would clear
  // it. Needs a sign-out signal that reaches an unmounted remote (e.g. clear in createRemoteApp
  // when the session ends); enable this test then.
  test.fixme('signing out drops the cached profile: signing in loads it again', async ({
    page,
  }) => {
    let reads = 0;
    let hold: Promise<void> | undefined;
    await page.route(/\/profile\/me$/, async (route) => {
      if (route.request().method() === 'GET') {
        reads += 1;
        await hold;
      }
      await route.continue();
    });

    await page.goto(remote.path);
    await signInWithMock(page);
    const container = remotePage(page, remote);
    await expect(container.getByTestId('profile-details')).toBeVisible();
    // (dev builds mount twice under StrictMode: count against this)
    const readsAfterFirstSignIn = reads;
    expect(readsAfterFirstSignIn).toBeGreaterThanOrEqual(1);

    // sign out and in again without a page load: the module-level cache would still have it
    await signOut(page);
    await expect(page.getByTestId('sign-in-prompt')).toBeVisible();
    let release: () => void = () => undefined;
    hold = new Promise<void>((resolve) => (release = resolve));
    await signInWithMock(page);

    // the profile is requested again, and while that is under way nothing of the old data shows
    await expect.poll(() => reads).toBeGreaterThan(readsAfterFirstSignIn);
    await expect(
      container.getByRole('status').filter({ hasText: 'Loading your profile' }),
    ).toBeVisible();
    await expect(container.getByTestId('profile-details')).toHaveCount(0);
    release();
    await expect(container.getByTestId('profile-details')).toContainText(
      'dev.user@example.org',
    );
  });
});
