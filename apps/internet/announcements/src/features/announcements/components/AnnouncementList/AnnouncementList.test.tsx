import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { HostPropsProvider } from '@org/mf-runtime/remote';
import { listAnnouncements } from '../../api';
import { maintenance } from '../../__fixtures__/announcements';
import { AnnouncementList } from './AnnouncementList';

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

  it('offers a retry when the list cannot be loaded', async () => {
    jest
      .mocked(listAnnouncements)
      .mockRejectedValue(new Error('503 Service Unavailable'));
    renderIn(<AnnouncementList />);
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Could not load the announcements',
    );
    expect(screen.getByRole('button', { name: 'Try again' })).toBeEnabled();
  });
});
