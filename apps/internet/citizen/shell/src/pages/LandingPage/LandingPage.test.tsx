import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  AuthProvider,
  SignInGate,
  type AuthClient,
  type AuthSession,
} from '@org/auth';
import { ThemeProvider } from '@org/ui';
import { APP_TITLE } from '@/core/constants/app';
import { LANDING_SIGN_IN_LABEL, LANDING_TITLE } from '@/core/constants/signIn';
import { SignedOutLayout } from '@/layouts/ShellLayout/ShellLayout';
import { LandingPage } from './LandingPage';

jest.mock('@org/pwa', () => ({ useOnlineStatus: () => true }));

function client(session: AuthSession): AuthClient & { signIn: jest.Mock } {
  return {
    kind: 'bff',
    getSession: async () => session,
    signIn: jest.fn(async () => session),
    signOut: async () => session,
  };
}

describe('LandingPage', () => {
  it('title, text and one sign-in button calling signIn (back to the current address)', async () => {
    const auth = client({ status: 'signedOut' });
    render(
      <AuthProvider client={auth}>
        <LandingPage />
      </AuthProvider>,
    );
    expect(
      screen.getByRole('heading', { level: 1, name: LANDING_TITLE }),
    ).toBeInTheDocument();
    const buttons = screen.getAllByRole('button');
    expect(buttons).toHaveLength(1);
    expect(buttons[0]).toHaveTextContent(LANDING_SIGN_IN_LABEL);
    await userEvent.click(buttons[0]);
    // no returnTo: the auth client returns to the current URL
    expect(auth.signIn).toHaveBeenCalledWith(undefined);
  });

  it('sign-in not configured: says so, no button', () => {
    render(
      <AuthProvider client={null}>
        <LandingPage />
      </AuthProvider>,
    );
    expect(screen.getByTestId('landing-page')).toHaveTextContent(
      'not configured',
    );
    expect(screen.queryByRole('button')).toBeNull();
  });
});

describe('LandingPage in SignInGate (as in src/app/App.tsx)', () => {
  it('signed out: brand-only header and the landing page; signed in: the portal', async () => {
    const auth = client({ status: 'signedOut' });
    auth.signIn.mockResolvedValue({
      status: 'signedIn',
      user: { id: 'u1', name: 'Ada' },
    });
    render(
      <ThemeProvider>
        <AuthProvider client={auth}>
          <SignInGate
            required
            mode="landing"
            landing={<LandingPage />}
            layout={SignedOutLayout}
          >
            <p>portal</p>
          </SignInGate>
        </AuthProvider>
      </ThemeProvider>,
    );
    expect(await screen.findByTestId('landing-page')).toBeInTheDocument();
    expect(screen.getByTestId('header-brand')).toHaveTextContent(APP_TITLE);
    expect(
      screen.getByRole('banner').querySelectorAll('button, a, input'),
    ).toHaveLength(0);
    expect(screen.queryByText('portal')).not.toBeInTheDocument();
    await userEvent.click(
      screen.getByRole('button', { name: LANDING_SIGN_IN_LABEL }),
    );
    expect(await screen.findByText('portal')).toBeInTheDocument();
  });
});
