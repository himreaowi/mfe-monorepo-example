import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { HostPropsProvider } from '@org/mf-runtime/remote';
import { maintenance } from '../../__fixtures__/announcements';
import type { AnnouncementsQuery } from '../../hooks/useAnnouncements';
import { AnnouncementList } from './AnnouncementList';

// A display component: the page loads the list and passes the result in (no API here).
function renderList(announcements: object) {
  return render(
    <MemoryRouter>
      <HostPropsProvider value={{ embedded: true, basePath: '/announcements' }}>
        <AnnouncementList announcements={announcements as AnnouncementsQuery} />
      </HostPropsProvider>
    </MemoryRouter>,
  );
}

const refetch = jest.fn();
beforeEach(() => refetch.mockReset());

describe('AnnouncementList', () => {
  it('shows loading', () => {
    renderList({ status: 'pending', refetch });
    expect(screen.getByRole('status')).toHaveTextContent('Loading');
  });

  it('lists announcements with date, topic and a link below the mount', () => {
    renderList({ status: 'success', data: [maintenance], refetch });
    const item = screen.getByTestId('announcement');
    expect(
      within(item).getByRole('link', {
        name: 'Online services maintenance on 25 October',
      }),
    ).toHaveAttribute('href', '/announcements/a-2026-031');
    expect(item).toHaveTextContent('16 October 2026, Service update');
  });

  it('says when there are none', () => {
    renderList({ status: 'success', data: [], refetch });
    expect(
      screen.getByText('There are no announcements right now.'),
    ).toBeInTheDocument();
  });

  it('offers a retry when the list cannot be loaded', async () => {
    renderList({
      status: 'error',
      error: new Error('503 Service Unavailable'),
      refetch,
    });
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Could not load the announcements',
    );
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(refetch).toHaveBeenCalledTimes(1);
  });
});
