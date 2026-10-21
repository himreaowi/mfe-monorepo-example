import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { Welcome } from './Welcome';

describe('Welcome', () => {
  it('explains how to add a remote when there is none', () => {
    render(
      <MemoryRouter>
        <Welcome remotes={[]} />
      </MemoryRouter>,
    );
    expect(screen.getByTestId('no-remotes')).toHaveTextContent(
      'pnpm gen:remote',
    );
  });

  it('lists remotes and marks private ones', () => {
    render(
      <MemoryRouter>
        <Welcome
          remotes={[
            {
              name: 'beta',
              title: 'Beta',
              path: '/beta',
              federationName: 'internet_beta',
              package: '@org/internet-beta',
              access: 'private',
              kind: 'react',
            },
          ]}
        />
      </MemoryRouter>,
    );
    expect(screen.getByRole('link', { name: 'Beta' })).toHaveAttribute(
      'href',
      '/beta',
    );
    expect(screen.getByText('sign-in required')).toBeInTheDocument();
  });
});
