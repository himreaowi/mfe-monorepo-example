import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AuthProvider, useAuth } from './AuthProvider';
import { RequireAuth } from './RequireAuth';
import { UserMenu } from './UserMenu';
import type { AuthClient, AuthSession } from './types';

const USER = { id: 'u-1', name: 'Ada' };

/** Controllable fake client. */
function fakeClient(initial: AuthSession = { status: 'signedOut' }) {
  let session: AuthSession = initial;
  const client = {
    kind: 'bff' as const,
    getSession: jest.fn(async () => session),
    signIn: jest.fn(async () => null),
    signOut: jest.fn(async () => {
      session = { status: 'signedOut' };
      return session;
    }),
    set(next: AuthSession) {
      session = next;
    },
  };
  return client satisfies AuthClient & { set: unknown };
}

const Protected = jest.fn(() => <p data-testid="protected">secret</p>);

function Probe() {
  const auth = useAuth();
  return (
    <output data-testid="probe">
      {auth.status}:{auth.user?.name ?? '-'}:{auth.csrfToken ?? '-'}
    </output>
  );
}

function renderWith(client: AuthClient | null, guard = <Protected />) {
  return render(
    <AuthProvider client={client}>
      <UserMenu />
      <Probe />
      <RequireAuth>{guard}</RequireAuth>
    </AuthProvider>,
  );
}

beforeEach(() => Protected.mockClear());

describe('AuthProvider + RequireAuth', () => {
  it('does not render guarded content before the session check resolves', async () => {
    const client = fakeClient({
      status: 'signedIn',
      user: USER,
      csrfToken: 'c',
    });
    renderWith(client);
    expect(screen.getByTestId('auth-status')).toHaveTextContent(
      'Checking sign-in',
    );
    expect(Protected).not.toHaveBeenCalled();
    expect(await screen.findByTestId('protected')).toBeInTheDocument();
    expect(screen.getByTestId('probe')).toHaveTextContent('signedIn:Ada:c');
    expect(screen.getByTestId('user-name')).toHaveTextContent('Ada');
  });

  it('signed out: shows the sign-in prompt and starts sign-in', async () => {
    const client = fakeClient();
    renderWith(client);
    expect(await screen.findByTestId('sign-in-prompt')).toBeInTheDocument();
    expect(Protected).not.toHaveBeenCalled();
    const buttons = screen.getAllByRole('button', { name: 'Sign in' });
    expect(buttons).toHaveLength(2); // header + prompt
    await userEvent.click(buttons[1]);
    expect(client.signIn).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('probe')).toHaveTextContent('redirecting');
  });

  it('sign-out returns to the guard', async () => {
    const client = fakeClient({ status: 'signedIn', user: USER });
    renderWith(client);
    await screen.findByTestId('protected');
    await userEvent.click(screen.getByRole('button', { name: 'Sign out' }));
    expect(await screen.findByTestId('sign-in-prompt')).toBeInTheDocument();
    expect(screen.queryByTestId('protected')).toBeNull();
  });

  it('BFF unreachable: prompt with the error and "Try again"', async () => {
    const client = fakeClient({
      status: 'signedOut',
      error: { code: 'network', message: 'Service down' },
    });
    renderWith(client);
    expect(await screen.findByTestId('auth-error')).toHaveTextContent(
      'Service down',
    );
    client.set({ status: 'signedIn', user: USER });
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByTestId('protected')).toBeInTheDocument();
  });

  it('disabled (no client): fails closed, no sign-in button', () => {
    renderWith(null);
    expect(screen.getByTestId('sign-in-prompt')).toHaveTextContent(
      'Sign-in unavailable',
    );
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.queryByTestId('user-menu')).toBeNull();
    expect(Protected).not.toHaveBeenCalled();
  });

  it('refresh() after a 401 (expired session) → signed out', async () => {
    const client = fakeClient({ status: 'signedIn', user: USER });
    let auth: ReturnType<typeof useAuth> | undefined;
    function Capture() {
      auth = useAuth();
      return null;
    }
    render(
      <AuthProvider client={client}>
        <Capture />
        <RequireAuth>
          <Protected />
        </RequireAuth>
      </AuthProvider>,
    );
    await screen.findByTestId('protected');
    client.set({ status: 'signedOut' });
    await act(() => auth!.refresh());
    expect(screen.getByTestId('sign-in-prompt')).toBeInTheDocument();
  });

  it('re-checks when expiresAt passes', async () => {
    jest.useFakeTimers();
    try {
      const client = fakeClient({
        status: 'signedIn',
        user: USER,
        expiresAt: new Date(Date.now() + 1000).toISOString(),
      });
      renderWith(client);
      await act(async () => {
        await Promise.resolve();
      });
      expect(screen.getByTestId('protected')).toBeInTheDocument();
      client.set({ status: 'signedOut' });
      await act(async () => {
        jest.advanceTimersByTime(2000);
      });
      await waitFor(() =>
        expect(screen.getByTestId('sign-in-prompt')).toBeInTheDocument(),
      );
    } finally {
      jest.useRealTimers();
    }
  });

  it('re-checks when the tab becomes visible', async () => {
    const client = fakeClient({ status: 'signedIn', user: USER });
    renderWith(client);
    await screen.findByTestId('protected');
    client.set({ status: 'signedOut' });
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    expect(await screen.findByTestId('sign-in-prompt')).toBeInTheDocument();
  });

  it('redirect mode signs in right away, but not when the BFF errored', async () => {
    const client = fakeClient();
    const { unmount } = render(
      <AuthProvider client={client}>
        <RequireAuth mode="redirect">
          <Protected />
        </RequireAuth>
      </AuthProvider>,
    );
    await waitFor(() => expect(client.signIn).toHaveBeenCalledTimes(1));
    expect(screen.getByTestId('auth-status')).toHaveTextContent(
      'Redirecting to sign-in',
    );
    unmount();

    const broken = fakeClient({
      status: 'signedOut',
      error: { code: 'network', message: 'down' },
    });
    render(
      <AuthProvider client={broken}>
        <RequireAuth mode="redirect">
          <Protected />
        </RequireAuth>
      </AuthProvider>,
    );
    expect(await screen.findByTestId('auth-error')).toBeInTheDocument();
    expect(broken.signIn).not.toHaveBeenCalled();
  });

  it('useAuth outside a provider is disabled, not an error', () => {
    render(<Probe />);
    expect(screen.getByTestId('probe')).toHaveTextContent('disabled:-:-');
  });
});
