import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { HostPropsProvider } from '@org/mf-runtime/remote';
import type { ApiResult } from '@org/use-api';
import { maintenance } from '../../__fixtures__/announcements';
import type { AnnouncementSummary } from '../../types/announcement';
import { AnnouncementList } from './AnnouncementList';

// A display component: the page loads the list and passes the result in (no API here).
function renderList(announcements: ApiResult<AnnouncementSummary[]>) {
  return render(
    <MemoryRouter>
      <HostPropsProvider value={{ embedded: true, basePath: '/announcements' }}>
        <AnnouncementList announcements={announcements} />
      </HostPropsProvider>
    </MemoryRouter>,
  );
}

const reload = jest.fn();
beforeEach(() => reload.mockReset());

describe('AnnouncementList', () => {
  it('shows loading', () => {
    renderList({ status: 'loading', reload });
    expect(screen.getByRole('status')).toHaveTextContent('Loading');
  });

  it('lists announcements with date, topic and a link below the mount', () => {
    renderList({ status: 'success', data: [maintenance], reload });
    const item = screen.getByTestId('announcement');
    expect(
      within(item).getByRole('link', {
        name: 'Online services maintenance on 25 October',
      }),
    ).toHaveAttribute('href', '/announcements/a-2026-031');
    expect(item).toHaveTextContent('16 October 2026, Service update');
  });

  it('says when there are none', () => {
    renderList({ status: 'success', data: [], reload });
    expect(
      screen.getByText('There are no announcements right now.'),
    ).toBeInTheDocument();
  });

  it('offers a retry when the list cannot be loaded', async () => {
    renderList({
      status: 'error',
      error: new Error('503 Service Unavailable'),
      reload,
    });
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Could not load the announcements',
    );
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(reload).toHaveBeenCalledTimes(1);
  });
});
