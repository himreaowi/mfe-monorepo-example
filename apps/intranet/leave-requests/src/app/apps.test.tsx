import path from 'node:path';
import { render, screen } from '@testing-library/react';
import { scanExposedModule } from '@org/jest-config/exposed-module';
import { MemoryRouter, Route, Routes } from 'react-router';
import { ThemeProvider } from '@org/ui';
import { getLeaveBalance, getLeaveRequests } from '@/features/leave/api';
import { balances, request } from '@/features/leave/__fixtures__/leave';
import EmbeddedApp, { StandaloneApp } from './apps';

jest.mock('@/features/leave/api');

beforeEach(() => {
  jest.mocked(getLeaveBalance).mockResolvedValue(balances);
  jest.mocked(getLeaveRequests).mockResolvedValue([request]);
});

function renderEmbedded(url: string) {
  return render(
    <ThemeProvider>
      <MemoryRouter initialEntries={[url]}>
        <Routes>
          <Route
            path="leave-requests/*"
            element={
              <EmbeddedApp
                embedded
                basePath="/leave-requests"
                settings={{ apiBaseUrl: 'https://api.test' }}
              />
            }
          />
        </Routes>
      </MemoryRouter>
    </ThemeProvider>,
  );
}

describe('Leave Requests remote', () => {
  it('embedded: overview below the shell mount, link to the form', async () => {
    renderEmbedded('/leave-requests');
    expect(
      screen.getByRole('heading', { level: 1, name: 'Leave' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Request leave' })).toHaveAttribute(
      'href',
      '/leave-requests/new',
    );
    expect(await screen.findByTestId('leave-request')).toBeInTheDocument();
  });

  it('embedded: /new renders the form', async () => {
    renderEmbedded('/leave-requests/new');
    expect(
      screen.getByRole('heading', { level: 1, name: 'Request leave' }),
    ).toBeInTheDocument();
    expect(
      await screen.findByRole('option', { name: 'No-pay leave' }),
    ).toBeInTheDocument();
  });

  it('standalone: renders with mock host props and its own chrome', () => {
    window.history.pushState({}, '', '/');
    render(<StandaloneApp />);
    expect(
      screen.getByRole('button', { name: 'Use dark theme' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Leave Requests (standalone)')).toBeInTheDocument();
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
