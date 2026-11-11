import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { HostPropsProvider } from '@org/mf-runtime/remote';
import { Demo } from './Demo';

describe('Demo', () => {
  it('standalone defaults: standalone badge, links from /', () => {
    render(
      <MemoryRouter>
        <Demo />
      </MemoryRouter>,
    );
    expect(screen.getByTestId('demo-feature')).toHaveAttribute(
      'data-embedded',
      'false',
    );
    expect(screen.getByRole('link', { name: 'Go to details' })).toHaveAttribute(
      'href',
      '/details',
    );
    // no AuthProvider around it (standalone): useAuth() is disabled, not an error
    expect(screen.getByTestId('demo-session')).toHaveTextContent('disabled');
  });

  it('embedded: shows host title and user, links below the mount', () => {
    render(
      <MemoryRouter>
        <HostPropsProvider
          value={{
            embedded: true,
            basePath: '/apps/x',
            title: 'From Host A',
            user: { id: 'u1', name: 'Ada' },
          }}
        >
          <Demo />
        </HostPropsProvider>
      </MemoryRouter>,
    );
    expect(screen.getByText('From Host A')).toBeInTheDocument();
    expect(screen.getByTestId('demo-user')).toHaveTextContent('Ada');
    expect(screen.getByRole('link', { name: 'Go to details' })).toHaveAttribute(
      'href',
      '/apps/x/details',
    );
  });

  it('keeps local state', async () => {
    render(
      <MemoryRouter>
        <Demo />
      </MemoryRouter>,
    );
    await userEvent.click(screen.getByRole('button', { name: /clicked 0/i }));
    expect(
      screen.getByRole('button', { name: /clicked 1/i }),
    ).toBeInTheDocument();
  });

  it('renders the content the page passes in (children)', () => {
    render(
      <MemoryRouter>
        <Demo>
          <p>From the page</p>
        </Demo>
      </MemoryRouter>,
    );
    expect(screen.getByTestId('demo-feature')).toHaveTextContent(
      'From the page',
    );
  });
});
