import type { ReactNode } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AuthProvider, useAuth } from './AuthProvider';
import { SignInGate } from './SignInGate';
import type { AuthClient, AuthSession } from './types';

/** A client whose session check resolves when `resolve()` is called. */
function client(initial: AuthSession) {
  let session = initial;
  let resolve: () => void = () => undefined;
  const pending = new Promise<void>((r) => {
    resolve = r;
  });
  const signIn = jest.fn(async () => {
    session = { status: 'signedIn', user: { id: 'u1', name: 'Ada' } };
    return session;
  });
  const auth: AuthClient = {
    kind: 'bff',
    getSession: async () => {
      await pending;
      return session;
    },
    signIn,
    signOut: async () => {
      session = { status: 'signedOut' };
      return session;
    },
  };
  return { auth, signIn, resolve };
}

/** The portal, with a sign-out button standing in for the header's user menu. */
function Portal() {
  const { signOut } = useAuth();
  return (
    <>
      <p>portal</p>
      <button type="button" onClick={() => void signOut()}>
        Sign out
      </button>
    </>
  );
}

function Landing() {
  const auth = useAuth();
  return (
    <section data-testid="landing">
      {auth.status === 'disabled' ? (
        'unavailable'
      ) : (
        <button type="button" onClick={() => void auth.signIn()}>
          Sign in
        </button>
      )}
    </section>
  );
}

function Layout({ children }: { children: ReactNode }) {
  return <main data-testid="signed-out-layout">{children}</main>;
}

function renderGate(
  auth: AuthClient | null,
  {
    required = true,
    mode = 'landing',
  }: { required?: boolean; mode?: 'landing' | 'redirect' } = {},
) {
  return render(
    <AuthProvider client={auth}>
      <SignInGate
        required={required}
        mode={mode}
        landing={<Landing />}
        layout={Layout}
      >
        <Portal />
      </SignInGate>
    </AuthProvider>,
  );
}

describe('SignInGate', () => {
  it('not required: renders the portal right away', () => {
    renderGate(client({ status: 'signedOut' }).auth, { required: false });
    expect(screen.getByText('portal')).toBeInTheDocument();
  });

  it('spinner inside the layout while the session is checked, never the portal', async () => {
    const c = client({ status: 'signedOut' });
    renderGate(c.auth);
    expect(screen.getByTestId('signed-out-layout')).toContainElement(
      screen.getByTestId('sign-in-gate-busy'),
    );
    expect(screen.getByTestId('sign-in-gate-busy')).toHaveTextContent(
      'Checking sign-in',
    );
    expect(screen.queryByText('portal')).not.toBeInTheDocument();
    c.resolve();
    expect(await screen.findByTestId('landing')).toBeInTheDocument();
  });

  it('landing: sign in shows the portal', async () => {
    const c = client({ status: 'signedOut' });
    c.resolve();
    renderGate(c.auth);
    await screen.findByTestId('landing');
    expect(screen.queryByText('portal')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByText('portal')).toBeInTheDocument();
    expect(screen.queryByTestId('signed-out-layout')).not.toBeInTheDocument();
  });

  it.each(['landing', 'redirect'] as const)(
    'signed in (%s): the portal; signing out shows the landing page again',
    async (mode) => {
      const c = client({ status: 'signedIn', user: { id: 'u1', name: 'Ada' } });
      c.resolve();
      renderGate(c.auth, { mode });
      expect(await screen.findByText('portal')).toBeInTheDocument();
      await userEvent.click(screen.getByRole('button', { name: 'Sign out' }));
      expect(await screen.findByTestId('landing')).toBeInTheDocument();
      expect(screen.queryByText('portal')).not.toBeInTheDocument();
      // no bounce back into single sign-on after an explicit sign-out
      expect(c.signIn).not.toHaveBeenCalled();
    },
  );

  it('redirect: calls signIn right away', async () => {
    const c = client({ status: 'signedOut' });
    c.resolve();
    renderGate(c.auth, { mode: 'redirect' });
    expect(await screen.findByText('portal')).toBeInTheDocument();
    expect(c.signIn).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId('landing')).not.toBeInTheDocument();
  });

  it('redirect: BFF error shows the landing page (no redirect loop)', async () => {
    const c = client({
      status: 'signedOut',
      error: { code: 'network', message: 'down' },
    });
    c.resolve();
    renderGate(c.auth, { mode: 'redirect' });
    expect(await screen.findByTestId('landing')).toBeInTheDocument();
    expect(c.signIn).not.toHaveBeenCalled();
  });

  it('sign-in not configured: fails closed', () => {
    renderGate(null, { mode: 'redirect' });
    expect(screen.getByTestId('landing')).toHaveTextContent('unavailable');
    expect(screen.queryByText('portal')).not.toBeInTheDocument();
  });

  it('no layout: renders the signed-out content bare', () => {
    render(
      <AuthProvider client={null}>
        <SignInGate required mode="landing" landing={<p>landing</p>}>
          <p>portal</p>
        </SignInGate>
      </AuthProvider>,
    );
    expect(screen.getByText('landing')).toBeInTheDocument();
  });
});
