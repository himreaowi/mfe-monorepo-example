import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HostPropsProvider } from '@org/mf-runtime/remote';
import { profile } from '../../__fixtures__/profile';
import type {
  ProfileQuery,
  SavePreferencesMutation,
} from '../../hooks/useProfile';
import { MyProfile } from './MyProfile';

const idleSave = {
  isPending: false,
  isSuccess: false,
  isError: false,
  error: null,
  mutate: jest.fn(),
  reset: jest.fn(),
} as unknown as SavePreferencesMutation;
const refetch = jest.fn();

// A display component: the page loads the profile and passes it in (no API here).
function renderProfile(result: object) {
  return render(
    <HostPropsProvider
      value={{
        embedded: true,
        basePath: '/my-profile',
        user: { id: 'mock-user-1', name: 'Dev User (mock)' },
      }}
    >
      <MyProfile profile={result as ProfileQuery} save={idleSave} />
    </HostPropsProvider>,
  );
}

describe('MyProfile', () => {
  it("shows the signed-in user's details and the notification choices", () => {
    renderProfile({ status: 'success', data: profile, refetch });
    expect(
      screen.getByRole('heading', { level: 1, name: 'My profile' }),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Signed in as Dev User (mock).'),
    ).toBeInTheDocument();
    const details = screen.getByTestId('profile-details');
    expect(details).toHaveTextContent('dev.user@example.org');
    expect(details).toHaveTextContent('Singapore 560123');
    expect(details).toHaveTextContent('April 2021');
    expect(
      screen.getByRole('form', { name: 'Notifications' }),
    ).toBeInTheDocument();
  });

  it('shows loading', () => {
    renderProfile({ status: 'pending', refetch });
    expect(screen.getByRole('status')).toHaveTextContent(
      'Loading your profile…',
    );
    expect(screen.queryByTestId('profile-details')).toBeNull();
  });

  it('offers a retry when the profile cannot be loaded', async () => {
    renderProfile({
      status: 'error',
      error: new Error('401 Unauthorized'),
      refetch,
    });
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Could not load your profile',
    );
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(refetch).toHaveBeenCalledTimes(1);
  });
});
