import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { HostPropsProvider } from '@org/mf-runtime/remote';
import { getAnnouncement } from '../../api';
import { maintenance } from '../../__fixtures__/announcements';
import { AnnouncementDetail } from './AnnouncementDetail';

jest.mock('../../api');

function renderIn(ui: React.ReactNode) {
  return render(
    <MemoryRouter>
      <HostPropsProvider
        value={{
          embedded: true,
          basePath: '/announcements',
          settings: { apiBaseUrl: 'https://api.test' },
        }}
      >
        {ui}
      </HostPropsProvider>
    </MemoryRouter>,
  );
}

describe('AnnouncementDetail', () => {
  it('shows the title, date and paragraphs', async () => {
    jest.mocked(getAnnouncement).mockResolvedValue(maintenance);
    renderIn(<AnnouncementDetail id="a-2026-031" />);
    expect(
      await screen.findByRole('heading', {
        level: 1,
        name: 'Online services maintenance on 25 October',
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText('We are upgrading our systems.'),
    ).toBeInTheDocument();
    expect(screen.getByText('16 October 2026')).toHaveAttribute(
      'datetime',
      maintenance.publishedAt,
    );
    expect(
      screen.getByRole('link', { name: 'Back to all announcements' }),
    ).toHaveAttribute('href', '/announcements');
  });

  it('handles a missing announcement', async () => {
    jest.mocked(getAnnouncement).mockResolvedValue(null);
    renderIn(<AnnouncementDetail id="gone" />);
    expect(
      await screen.findByRole('heading', { name: 'Announcement not found' }),
    ).toBeInTheDocument();
  });

  it('shows loading, then offers a retry when it cannot be loaded', async () => {
    jest
      .mocked(getAnnouncement)
      .mockRejectedValue(new Error('500 Internal Server Error'));
    renderIn(<AnnouncementDetail id="a-2026-031" />);
    expect(screen.getByRole('status')).toHaveTextContent('Loading');
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Could not load this announcement',
    );
    expect(
      screen.getByRole('link', { name: 'Back to all announcements' }),
    ).toBeInTheDocument();
  });
});
