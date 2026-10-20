import path from 'node:path';
import { render, screen } from '@testing-library/react';
import { scanExposedModule } from '@org/jest-config/exposed-module';
import { MemoryRouter, Route, Routes } from 'react-router';
import { ThemeProvider } from '@org/ui';
import {
  getCategories,
  getService,
  listServices,
} from '@/features/catalogue/api/catalogueApi';
import { dogLicence } from '@/features/catalogue/__fixtures__/services';
import EmbeddedApp, { StandaloneApp } from './apps';

jest.mock('@/features/catalogue/api/catalogueApi');

beforeEach(() => {
  jest.mocked(getCategories).mockResolvedValue([]);
  jest.mocked(listServices).mockResolvedValue({
    items: [dogLicence],
    total: 1,
    categories: [],
  });
  jest.mocked(getService).mockResolvedValue(dogLicence);
});

function renderEmbedded(url: string) {
  return render(
    <ThemeProvider>
      <MemoryRouter initialEntries={[url]}>
        <Routes>
          <Route
            path="services/*"
            element={
              <EmbeddedApp
                embedded
                basePath="/services"
                settings={{ apiBaseUrl: 'https://api.test' }}
              />
            }
          />
        </Routes>
      </MemoryRouter>
    </ThemeProvider>,
  );
}

describe('Services remote', () => {
  it('embedded: catalogue below the shell mount', async () => {
    renderEmbedded('/services');
    expect(
      screen.getByRole('heading', { level: 1, name: 'Services' }),
    ).toBeInTheDocument();
    expect(
      await screen.findByRole('link', { name: 'Renew a dog licence' }),
    ).toHaveAttribute('href', '/services/renew-dog-licence');
  });

  it('embedded: a slug opens the service page; deeper paths are 404', async () => {
    renderEmbedded('/services/renew-dog-licence');
    expect(
      await screen.findByRole('heading', {
        level: 1,
        name: 'Renew a dog licence',
      }),
    ).toBeInTheDocument();
  });

  it('embedded: unknown deep paths show the remote 404 page', () => {
    renderEmbedded('/services/a/b');
    expect(screen.getByTestId('remote-not-found-page')).toBeInTheDocument();
  });

  it('standalone: renders with mock host props and its own chrome', () => {
    window.history.pushState({}, '', '/');
    render(<StandaloneApp />);
    expect(
      screen.getByRole('button', { name: 'Use dark theme' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Services (standalone)')).toBeInTheDocument();
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
