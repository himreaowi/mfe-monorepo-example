import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpClientError } from '@org/http-client';
import { useSubmit } from '@org/use-api';
import { profile } from '../../__fixtures__/profile';
import type { Preferences, Profile } from '../../types/profile';
import { PreferencesForm } from './PreferencesForm';

/**
 * The form sends nothing itself: the page passes `save` (useSavePreferences()). Here a real
 * useSubmit around a fake `send` gives it the same idle → submitting → success | error states.
 */
function renderForm(
  send: (preferences: Preferences) => Promise<Profile> = jest.fn(),
) {
  function Harness() {
    const save = useSubmit((preferences: Preferences) => send(preferences));
    return <PreferencesForm initial={profile.preferences} save={save} />;
  }
  render(<Harness />);
  return { send, user: userEvent.setup() };
}

describe('PreferencesForm', () => {
  it('starts from the saved choices in a labelled group', () => {
    renderForm();
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

  it('saves the notification choices, disabled only while saving, and confirms', async () => {
    let resolve: (value: Profile) => void = () => undefined;
    const send = jest.fn(() => new Promise<Profile>((r) => (resolve = r)));
    const { user } = renderForm(send);
    await user.click(
      screen.getByRole('checkbox', { name: /Send me SMS reminders/ }),
    );
    await user.click(screen.getByRole('button', { name: 'Save choices' }));
    expect(send).toHaveBeenCalledWith({
      emailUpdates: true,
      smsReminders: true,
    });
    expect(screen.getByRole('button', { name: 'Saving…' })).toBeDisabled();
    resolve({
      ...profile,
      preferences: { emailUpdates: true, smsReminders: true },
    });
    expect(
      await screen.findByText('Your choices are saved.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save choices' })).toBeEnabled();
  });

  it('reports a failed save', async () => {
    const { user } = renderForm(
      jest.fn().mockRejectedValue(new Error('403 Forbidden')),
    );
    await user.click(screen.getByRole('button', { name: 'Save choices' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Your choices could not be saved (403 Forbidden). Try again.',
    );
  });

  it('shows a 422 from the API as a focused error summary and a field error', async () => {
    const { user } = renderForm(
      jest.fn().mockRejectedValue(
        new HttpClientError(
          {
            status: 422,
            statusText: 'Unprocessable Entity',
            url: 'https://api.test/api/profile/me/preferences',
          } as Response,
          { errors: { preferences: 'Choose yes or no for each option' } },
        ),
      ),
    );
    const save = screen.getByRole('button', { name: 'Save choices' });
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
