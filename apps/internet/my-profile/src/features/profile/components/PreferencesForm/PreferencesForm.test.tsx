import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useAuth } from '@org/auth';
import { HttpClientError } from '@org/http-client';
import { HostPropsProvider } from '@org/mf-runtime/remote';
import { updatePreferences } from '../../api';
import { profile } from '../../__fixtures__/profile';
import { PreferencesForm } from './PreferencesForm';

jest.mock('../../api');
jest.mock('@org/auth', () => ({ useAuth: jest.fn() }));

function renderProfile() {
  return render(
    <HostPropsProvider value={{ embedded: true, basePath: '/my-profile' }}>
      <PreferencesForm initial={profile.preferences} />
    </HostPropsProvider>,
  );
}

beforeEach(() => {
  jest.mocked(updatePreferences).mockReset();
  jest.mocked(useAuth).mockReturnValue({
    csrfToken: 'csrf-1',
    csrfHeaderName: 'X-CSRF-Token',
    refresh: jest.fn(),
  } as unknown as ReturnType<typeof useAuth>);
});

describe('PreferencesForm', () => {
  it('starts from the saved choices in a labelled group', () => {
    renderProfile();
    expect(
      screen.getByRole('form', { name: 'Notifications' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('group', { name: 'How should we keep you informed?' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: /Email me/ })).toBeChecked();
    expect(
      screen.getByRole('checkbox', { name: /Send me SMS reminders/ }),
    ).not.toBeChecked();
    expect(screen.getByRole('button', { name: 'Save choices' })).toBeEnabled();
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

  it('shows a 422 from the API as a focused error summary and a field error', async () => {
    const user = userEvent.setup();
    jest.mocked(updatePreferences).mockRejectedValue(
      new HttpClientError(
        {
          status: 422,
          statusText: 'Unprocessable Entity',
          url: 'https://api.test/api/profile/me/preferences',
        } as Response,
        { errors: { preferences: 'Choose yes or no for each option' } },
      ),
    );
    renderProfile();
    const save = await screen.findByRole('button', { name: 'Save choices' });
    await user.click(save);
    const summary = await screen.findByTestId('error-summary');
    expect(summary).toHaveTextContent('There is a problem');
    await waitFor(() => expect(summary).toHaveFocus());
    const group = screen.getByRole('group', {
      name: 'How should we keep you informed?',
    });
    expect(group).toHaveAccessibleDescription(
      'Error: Choose yes or no for each option',
    );
    expect(screen.getByRole('checkbox', { name: /Email me/ })).toHaveAttribute(
      'aria-invalid',
      'true',
    );
    // the only generic alert is the summary: no "could not be saved" message
    expect(screen.queryByText(/could not be saved/)).not.toBeInTheDocument();
    await user.click(
      screen.getByRole('link', { name: 'Choose yes or no for each option' }),
    );
    expect(screen.getByRole('checkbox', { name: /Email me/ })).toHaveFocus();
    expect(save).toBeEnabled();
  });
});
