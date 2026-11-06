import { render, screen } from '@testing-library/react';
import { MemoryRouter, useRoutes } from 'react-router';
import { ThemeProvider } from '@org/ui';
import type { RemoteEntry } from '@/core/types/remotes';
import { createRoutes } from './routes';

jest.mock('@org/mf-runtime', () => ({
  RemoteApp: ({ name }: { name: string }) => (
    <div data-testid="remote-app">{name}</div>
  ),
}));

const remotes: RemoteEntry[] = [
  {
    name: 'alpha',
    title: 'Alpha',
    path: '/alpha',
    federationName: 'internet_alpha',
    package: '@org/internet-alpha',
    access: 'public',
    kind: 'react',
  },
];

function Routes() {
  return useRoutes(createRoutes(remotes));
}

function renderAt(url: string) {
  return render(
    <ThemeProvider>
      <MemoryRouter initialEntries={[url]}>
        <Routes />
      </MemoryRouter>
    </ThemeProvider>,
  );
}

describe('shell routes', () => {
  it('renders the home page at /', () => {
    renderAt('/');
    expect(screen.getByTestId('home-page')).toBeInTheDocument();
  });

  it('mounts the remote under /<remote>/*', () => {
    renderAt('/alpha/details/1');
    expect(screen.getByTestId('remote-app')).toHaveTextContent(
      'internet_alpha',
    );
  });

  it('shows the 404 page for unknown paths', () => {
    renderAt('/nope');
    expect(screen.getByTestId('not-found-page')).toBeInTheDocument();
  });
});
