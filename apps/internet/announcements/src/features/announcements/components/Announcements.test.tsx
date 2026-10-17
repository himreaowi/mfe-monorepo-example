import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { HostPropsProvider } from '@org/mf-runtime/remote';
import { getAnnouncement, listAnnouncements } from '../api';
import { AnnouncementDetail } from './AnnouncementDetail';
import { AnnouncementList } from './AnnouncementList';
import { maintenance } from './testData';

jest.mock('../api');

function renderIn(ui: React.ReactNode) {
  return render(
    <MemoryRouter>
      <HostPropsProvider value={{ embedded: true, basePath: '/announcements' }}>
        {ui}
      </HostPropsProvider>
    </MemoryRouter>,
  );
}

describe('AnnouncementList', () => {
  it('lists announcements with date, topic and a link below the mount', async () => {
    jest.mocked(listAnnouncements).mockResolvedValue([maintenance]);
    renderIn(<AnnouncementList />);
    expect(screen.getByRole('status')).toHaveTextContent('Loading');
    const item = await screen.findByTestId('announcement');
    expect(
      within(item).getByRole('link', {
        name: 'Online services maintenance on 25 October',
      }),
    ).toHaveAttribute('href', '/announcements/a-2026-031');
    expect(item).toHaveTextContent('16 October 2026, Service update');
  });

  it('says when there are none', async () => {
    jest.mocked(listAnnouncements).mockResolvedValue([]);
    renderIn(<AnnouncementList />);
    expect(
      await screen.findByText('There are no announcements right now.'),
    ).toBeInTheDocument();
  });
});

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
});
