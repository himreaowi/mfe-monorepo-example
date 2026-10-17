import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import type { RemoteEntry } from '@/core/types/remotes';
import { RemoteNav } from './RemoteNav';

const remotes: RemoteEntry[] = [
  {
    name: 'alpha',
    title: 'Alpha',
    path: '/alpha',
    federationName: 'intranet_alpha',
    package: '@org/intranet-alpha',
    access: 'public',
    kind: 'react',
  },
  {
    name: 'beta',
    title: 'Beta',
    path: '/beta',
    federationName: 'intranet_beta',
    package: '@org/intranet-beta',
    access: 'private',
    kind: 'react',
  },
];

describe('RemoteNav', () => {
  it('always links Home', () => {
    render(
      <MemoryRouter>
        <RemoteNav remotes={[]} />
      </MemoryRouter>,
    );
    expect(screen.getByRole('link', { name: 'Home' })).toHaveAttribute(
      'href',
      '/',
    );
  });

  it('links every registered remote to its mount path', () => {
    render(
      <MemoryRouter>
        <RemoteNav remotes={remotes} />
      </MemoryRouter>,
    );
    expect(screen.getByRole('link', { name: 'Alpha' })).toHaveAttribute(
      'href',
      '/alpha',
    );
    expect(screen.getByRole('link', { name: 'Beta' })).toHaveAttribute(
      'data-access',
      'private',
    );
  });

  it('has a Menu disclosure that opens, closes on Escape and after navigation', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <RemoteNav remotes={remotes} />
      </MemoryRouter>,
    );
    const button = screen.getByRole('button', { name: 'Menu' });
    expect(button).toHaveAttribute('aria-expanded', 'false');
    expect(button).toHaveAttribute(
      'aria-controls',
      screen.getByRole('list', { name: 'Apps' }).id,
    );
    await user.click(button);
    expect(button).toHaveAttribute('aria-expanded', 'true');
    await user.keyboard('{Escape}');
    expect(button).toHaveAttribute('aria-expanded', 'false');
    expect(button).toHaveFocus();
    await user.click(button);
    await user.click(screen.getByRole('link', { name: 'Alpha' }));
    expect(button).toHaveAttribute('aria-expanded', 'false');
  });
});
