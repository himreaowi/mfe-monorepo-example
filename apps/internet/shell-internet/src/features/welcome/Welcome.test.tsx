import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { useAuth } from '@org/auth';
import type { RemoteEntry } from '@/core/types/remotes';
import { Welcome } from './Welcome';

jest.mock('@org/auth', () => ({ useAuth: jest.fn() }));
const useAuthMock = jest.mocked(useAuth);

const beta: RemoteEntry = {
  name: 'beta',
  title: 'Beta',
  description: 'Does beta things.',
  path: '/beta',
  federationName: 'internet_beta',
  package: '@org/internet-beta',
  access: 'private',
  kind: 'react',
};

function renderWelcome(remotes: RemoteEntry[]) {
  return render(
    <MemoryRouter>
      <Welcome remotes={remotes} />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  useAuthMock.mockReturnValue({
    status: 'signedOut',
    user: null,
  } as ReturnType<typeof useAuth>);
});

describe('Welcome', () => {
  it('names the portal and explains how to add a remote when there is none', () => {
    renderWelcome([]);
    expect(
      screen.getByRole('heading', { level: 1, name: 'Citizen Portal' }),
    ).toBeInTheDocument();
    expect(screen.getByTestId('no-remotes')).toHaveTextContent(
      'pnpm gen:remote',
    );
  });

  it('shows a card per remote with its description and marks private ones', () => {
    renderWelcome([beta]);
    expect(screen.getByRole('link', { name: 'Beta' })).toHaveAttribute(
      'href',
      '/beta',
    );
    expect(screen.getByText('Does beta things.')).toBeInTheDocument();
    expect(screen.getByText('Sign-in required')).toBeInTheDocument();
    expect(screen.queryByTestId('welcome-user')).not.toBeInTheDocument();
  });

  it('greets the signed-in user', () => {
    useAuthMock.mockReturnValue({
      status: 'signedIn',
      user: { id: 'u1', name: 'Ada' },
    } as ReturnType<typeof useAuth>);
    renderWelcome([beta]);
    expect(screen.getByTestId('welcome-user')).toHaveTextContent(
      'Welcome back, Ada.',
    );
  });
});
