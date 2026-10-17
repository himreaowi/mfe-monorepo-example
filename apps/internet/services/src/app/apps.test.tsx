import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { ThemeProvider } from '@org/ui';
import { EmbeddedApp, StandaloneApp } from './apps';

describe('Services remote', () => {
  it('embedded: renders below the shell mount with host props', () => {
    render(
      <ThemeProvider>
        <MemoryRouter initialEntries={['/services']}>
          <Routes>
            <Route
              path="services/*"
              element={
                <EmbeddedApp
                  embedded
                  basePath="/services"
                  title="From shell"
                  user={{ id: 'u1', name: 'Shell User' }}
                />
              }
            />
          </Routes>
        </MemoryRouter>
      </ThemeProvider>,
    );
    expect(screen.getByTestId('mode-badge')).toHaveTextContent('Embedded');
    expect(screen.getByText('From shell')).toBeInTheDocument();
    expect(screen.getByTestId('demo-user')).toHaveTextContent('Shell User');
    expect(screen.getByRole('link', { name: /details/i })).toHaveAttribute(
      'href',
      '/services/details',
    );
  });

  it('standalone: renders with mock host props and its own chrome', () => {
    window.history.pushState({}, '', '/');
    render(<StandaloneApp />);
    expect(screen.getByTestId('mode-badge')).toHaveTextContent('Standalone');
    expect(screen.getByTestId('demo-user')).toHaveTextContent('Dev User');
    expect(
      screen.getByRole('button', { name: 'Use dark theme' }),
    ).toBeInTheDocument();
  });
});
