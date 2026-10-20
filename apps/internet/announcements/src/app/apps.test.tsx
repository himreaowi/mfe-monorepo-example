import path from 'node:path';
import { render, screen } from '@testing-library/react';
import { scanExposedModule } from '@org/jest-config/exposed-module';
import { MemoryRouter, Route, Routes } from 'react-router';
import { ThemeProvider } from '@org/ui';
import {
  getAnnouncement,
  listAnnouncements,
} from '@/features/announcements/api';
import { maintenance } from '@/features/announcements/__fixtures__/announcements';
import EmbeddedApp, { StandaloneApp } from './apps';

jest.mock('@/features/announcements/api');

beforeEach(() => {
  jest.mocked(listAnnouncements).mockResolvedValue([maintenance]);
  jest.mocked(getAnnouncement).mockResolvedValue(maintenance);
});

function renderEmbedded(url: string) {
  return render(
    <ThemeProvider>
      <MemoryRouter initialEntries={[url]}>
        <Routes>
          <Route
            path="announcements/*"
            element={
              <EmbeddedApp
                embedded
                basePath="/announcements"
                settings={{ apiBaseUrl: 'https://api.test' }}
              />
            }
          />
        </Routes>
      </MemoryRouter>
    </ThemeProvider>,
  );
}

describe('Announcements remote', () => {
  it('embedded: list below the shell mount, detail by id', async () => {
    renderEmbedded('/announcements');
    expect(
      await screen.findByRole('link', {
        name: 'Online services maintenance on 25 October',
      }),
    ).toHaveAttribute('href', '/announcements/a-2026-031');
  });

  it('embedded: /<id> renders the announcement', async () => {
    renderEmbedded('/announcements/a-2026-031');
    expect(
      await screen.findByRole('heading', {
        level: 1,
        name: 'Online services maintenance on 25 October',
      }),
    ).toBeInTheDocument();
  });

  it('standalone: renders with mock host props and its own chrome', () => {
    window.history.pushState({}, '', '/');
    render(<StandaloneApp />);
    expect(
      screen.getByRole('button', { name: 'Use dark theme' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Announcements (standalone)')).toBeInTheDocument();
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
