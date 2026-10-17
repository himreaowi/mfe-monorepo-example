import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { ThemeProvider } from '@org/ui';
import { getProfile } from '@/features/profile/api';
import { profile } from '@/features/profile/components/testData';
import { EmbeddedApp, StandaloneApp } from './apps';

jest.mock('@/features/profile/api');

beforeEach(() => {
  jest.mocked(getProfile).mockResolvedValue(profile);
});

describe('My Profile remote', () => {
  it('embedded: shows the profile of the user the shell passes', async () => {
    render(
      <ThemeProvider>
        <MemoryRouter initialEntries={['/my-profile']}>
          <Routes>
            <Route
              path="my-profile/*"
              element={
                <EmbeddedApp
                  embedded
                  basePath="/my-profile"
                  user={{ id: 'mock-user-1', name: 'Shell User' }}
                />
              }
            />
          </Routes>
        </MemoryRouter>
      </ThemeProvider>,
    );
    expect(screen.getByText('Signed in as Shell User.')).toBeInTheDocument();
    expect(await screen.findByTestId('profile-details')).toHaveTextContent(
      'dev.user@example.org',
    );
  });

  it('standalone: renders with mock host props and its own chrome', async () => {
    window.history.pushState({}, '', '/');
    render(<StandaloneApp />);
    expect(
      screen.getByRole('button', { name: 'Use dark theme' }),
    ).toBeInTheDocument();
    expect(screen.getByText('My profile (standalone)')).toBeInTheDocument();
    expect(await screen.findByTestId('profile-details')).toBeInTheDocument();
  });
});
