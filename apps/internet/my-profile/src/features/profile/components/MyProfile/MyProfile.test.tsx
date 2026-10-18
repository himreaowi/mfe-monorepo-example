import { render, screen } from '@testing-library/react';
import { useAuth } from '@org/auth';
import { HttpClientError } from '@org/http-client';
import { HostPropsProvider } from '@org/mf-runtime/remote';
import { getProfile } from '../../api';
import { MyProfile } from './MyProfile';
import { profile } from '../../__fixtures__/profile';

jest.mock('../../api');
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
    expect(
      screen.getByRole('form', { name: 'Notifications' }),
    ).toBeInTheDocument();
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
