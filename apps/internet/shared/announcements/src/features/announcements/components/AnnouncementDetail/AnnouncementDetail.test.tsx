import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { HostPropsProvider } from '@org/mf-runtime/remote';
import type { ApiResult } from '@org/use-api';
import { maintenance } from '../../__fixtures__/announcements';
import type { Announcement } from '../../types/announcement';
import { AnnouncementDetail } from './AnnouncementDetail';

// A display component: the page loads the announcement and passes the result in.
function renderDetail(announcement: ApiResult<Announcement | null>) {
  return render(
    <MemoryRouter>
      <HostPropsProvider value={{ embedded: true, basePath: '/announcements' }}>
        <AnnouncementDetail announcement={announcement} />
      </HostPropsProvider>
    </MemoryRouter>,
  );
}

const reload = jest.fn();

describe('AnnouncementDetail', () => {
  it('shows the title, date and paragraphs', () => {
    renderDetail({ status: 'success', data: maintenance, reload });
    expect(
      screen.getByRole('heading', {
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

  it('handles a missing announcement', () => {
    renderDetail({ status: 'success', data: null, reload });
    expect(
      screen.getByRole('heading', { name: 'Announcement not found' }),
    ).toBeInTheDocument();
  });

  it('shows loading without the back link', () => {
    renderDetail({ status: 'loading', reload });
    expect(screen.getByRole('status')).toHaveTextContent('Loading');
    expect(
      screen.queryByRole('link', { name: 'Back to all announcements' }),
    ).toBeNull();
  });

  it('offers a retry when it cannot be loaded', () => {
    renderDetail({
      status: 'error',
      error: new Error('500 Internal Server Error'),
      reload,
    });
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Could not load this announcement',
    );
    expect(
      screen.getByRole('link', { name: 'Back to all announcements' }),
    ).toBeInTheDocument();
  });
});
