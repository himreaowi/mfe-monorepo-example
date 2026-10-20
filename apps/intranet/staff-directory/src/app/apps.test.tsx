import path from 'node:path';
import { render, screen } from '@testing-library/react';
import { scanExposedModule } from '@org/jest-config/exposed-module';
import { MemoryRouter, Route, Routes } from 'react-router';
import { ThemeProvider } from '@org/ui';
import {
  getDepartments,
  getStaffMember,
  searchStaff,
} from '@/features/staff/api';
import EmbeddedApp, { StandaloneApp } from './apps';

jest.mock('@/features/staff/api');

beforeEach(() => {
  jest.mocked(getDepartments).mockResolvedValue([]);
  jest.mocked(searchStaff).mockResolvedValue({
    items: [
      {
        id: 's-1001',
        name: 'Aisha Rahman',
        jobTitle: 'Director',
        department: 'Digital Services',
        location: 'Level 12',
        email: 'aisha.rahman@example.org',
        phone: '+65 6555 1001',
      },
    ],
    total: 1,
    departments: [],
  });
  jest.mocked(getStaffMember).mockResolvedValue(null);
});

function renderEmbedded(url: string) {
  return render(
    <ThemeProvider>
      <MemoryRouter initialEntries={[url]}>
        <Routes>
          <Route
            path="staff-directory/*"
            element={
              <EmbeddedApp
                embedded
                basePath="/staff-directory"
                settings={{ apiBaseUrl: 'https://api.test' }}
                user={{ id: 'u1', name: 'Shell User' }}
              />
            }
          />
        </Routes>
      </MemoryRouter>
    </ThemeProvider>,
  );
}

describe('Staff Directory remote', () => {
  it('embedded: renders the search below the shell mount', async () => {
    renderEmbedded('/staff-directory');
    expect(
      screen.getByRole('heading', { level: 1, name: 'Staff directory' }),
    ).toBeInTheDocument();
    expect(
      await screen.findByRole('link', { name: 'Aisha Rahman' }),
    ).toHaveAttribute('href', '/staff-directory/s-1001');
  });

  it('embedded: routes a staff id to the detail page and unknown paths to 404', async () => {
    renderEmbedded('/staff-directory/s-9999');
    expect(
      await screen.findByRole('heading', { name: 'Staff member not found' }),
    ).toBeInTheDocument();
  });

  it('embedded: deep paths show the remote 404 page', () => {
    renderEmbedded('/staff-directory/a/b/c');
    expect(screen.getByTestId('remote-not-found-page')).toBeInTheDocument();
  });

  it('standalone: renders with mock host props and its own chrome', async () => {
    window.history.pushState({}, '', '/');
    render(<StandaloneApp />);
    expect(
      screen.getByRole('button', { name: 'Use dark theme' }),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Staff Directory (standalone)'),
    ).toBeInTheDocument();
    expect(await screen.findByText('Aisha Rahman')).toBeInTheDocument();
  });

  it('exposed module: nothing it reaches imports global styles or registers a service worker', () => {
    const { files, violations } = scanExposedModule(
      path.join(__dirname, 'apps.tsx'),
    );
    expect(violations).toEqual([]);
    // the walk reached the feature components (features/<name>/components/<Name>/<Name>.tsx)
    expect(
      files.some((file) =>
        /[\\/]features[\\/][^\\/]+[\\/]components[\\/]/.test(file),
      ),
    ).toBe(true);
  });
});
