import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { AuthProvider, type AuthClient, type AuthSession } from '@org/auth';
import type { RemoteEntry } from '@/core/types/remotes';
import { RemotePage } from './RemotePage';

const mockRemoteApp = jest.fn();
jest.mock('@org/mf-runtime', () => ({
  RemoteApp: (props: {
    name: string;
    props: { user?: { name?: string } | null };
  }) => {
    mockRemoteApp(props);
    return (
      <div data-testid="remote-app">
        {props.name}:{props.props.user?.name ?? String(props.props.user)}
      </div>
    );
  },
}));

const entry = (access: RemoteEntry['access']): RemoteEntry => ({
  name: 'beta',
  title: 'Beta',
  path: '/beta',
  federationName: 'intranet_beta',
  package: '@org/intranet-beta',
  access,
  kind: 'react',
});

function client(initial: AuthSession): AuthClient {
  let session = initial;
  return {
    kind: 'bff',
    getSession: async () => session,
    signIn: async () => {
      session = { status: 'signedIn', user: { id: 'u1', name: 'Ada' } };
      return session;
    },
    signOut: async () => {
      session = { status: 'signedOut' };
      return session;
    },
  };
}

function renderPage(remote: RemoteEntry, auth: AuthClient | null) {
  return render(
    <MemoryRouter>
      <AuthProvider client={auth}>
        <RemotePage remote={remote} />
      </AuthProvider>
    </MemoryRouter>,
  );
}

describe('RemotePage', () => {
  beforeEach(() => mockRemoteApp.mockClear());

  it('private remote: not rendered (not downloaded) until signed in, then gets the user', async () => {
    renderPage(entry('private'), client({ status: 'signedOut' }));
    expect(await screen.findByTestId('sign-in-prompt')).toHaveTextContent(
      'Sign in to use Beta',
    );
    expect(mockRemoteApp).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByTestId('remote-app')).toHaveTextContent(
      'intranet_beta:Ada',
    );
  });

  it('private remote without auth configured: stays closed', () => {
    renderPage(entry('private'), null);
    expect(screen.getByTestId('sign-in-prompt')).toHaveTextContent(
      'Sign-in unavailable',
    );
    expect(mockRemoteApp).not.toHaveBeenCalled();
  });

  it('public remote: rendered for everyone, user null when signed out', async () => {
    renderPage(entry('public'), client({ status: 'signedOut' }));
    expect(await screen.findByTestId('remote-app')).toHaveTextContent(
      'intranet_beta:null',
    );
  });
});
