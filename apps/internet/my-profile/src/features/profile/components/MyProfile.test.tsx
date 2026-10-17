import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useAuth } from '@org/auth';
import { HttpClientError } from '@org/http-client';
import { HostPropsProvider } from '@org/mf-runtime/remote';
import { getProfile, updatePreferences } from '../api';
import { MyProfile } from './MyProfile';
import { profile } from './testData';

jest.mock('../api');
jest.mock('@org/auth', () => ({ useAuth: jest.fn() }));

const refresh = jest.fn();

function renderProfile() {
  return render(
    <HostPropsProvider
      value={{
        embedded: true,
        basePath: '/my-profile',
        user: { id: 'mock-user-1', name: 'Dev User (mock)' },
      }}
    >
      <MyProfile />
    </HostPropsProvider>,
  );
}

beforeEach(() => {
  refresh.mockReset();
  jest.mocked(useAuth).mockReturnValue({
    csrfToken: 'csrf-1',
    csrfHeaderName: 'X-CSRF-Token',
    refresh,
  } as unknown as ReturnType<typeof useAuth>);
  jest.mocked(getProfile).mockResolvedValue(profile);
});

describe('MyProfile', () => {
  it("shows the signed-in user's details", async () => {
    renderProfile();
    expect(
      screen.getByRole('heading', { level: 1, name: 'My profile' }),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Signed in as Dev User (mock).'),
    ).toBeInTheDocument();
    const details = await screen.findByTestId('profile-details');
    expect(details).toHaveTextContent('dev.user@example.org');
    expect(details).toHaveTextContent('Singapore 560123');
    expect(details).toHaveTextContent('April 2021');
  });

  it('saves notification choices with the CSRF header and confirms', async () => {
    const user = userEvent.setup();
    jest.mocked(updatePreferences).mockResolvedValue({
      ...profile,
      preferences: { emailUpdates: true, smsReminders: true },
    });
    renderProfile();
    const sms = await screen.findByRole('checkbox', {
      name: /Send me SMS reminders/,
    });
    expect(sms).not.toBeChecked();
    await user.click(sms);
    await user.click(screen.getByRole('button', { name: 'Save choices' }));
    expect(
      await screen.findByText('Your choices are saved.'),
    ).toBeInTheDocument();
    expect(updatePreferences).toHaveBeenCalledWith(
      expect.anything(),
      { emailUpdates: true, smsReminders: true },
      { 'X-CSRF-Token': 'csrf-1' },
      expect.any(AbortSignal),
    );
  });

  it('reports a failed save', async () => {
    const user = userEvent.setup();
    jest
      .mocked(updatePreferences)
      .mockRejectedValue(new Error('403 Forbidden'));
    renderProfile();
    await user.click(
      await screen.findByRole('button', { name: 'Save choices' }),
    );
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Your choices could not be saved (403 Forbidden). Try again.',
    );
  });

  it('asks the shell to re-check the session after a 401', async () => {
    jest.mocked(getProfile).mockRejectedValue(
      new HttpClientError({
        status: 401,
        statusText: 'Unauthorized',
        url: 'https://api.test/api/profile/me',
      } as Response),
    );
    renderProfile();
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Could not load your profile',
    );
    expect(refresh).toHaveBeenCalled();
  });
});
