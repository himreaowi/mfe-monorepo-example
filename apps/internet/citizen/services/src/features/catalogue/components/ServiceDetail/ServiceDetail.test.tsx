import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { HostPropsProvider } from '@org/mf-runtime/remote';
import type { ApiResult } from '@org/use-api';
import { dogLicence } from '../../__fixtures__/services';
import type { Service } from '../../types/service';
import { ServiceDetail } from './ServiceDetail';

// A display component: the page loads the service and passes the result in.
function renderDetail(service: ApiResult<Service | null>) {
  return render(
    <MemoryRouter>
      <HostPropsProvider value={{ embedded: true, basePath: '/services' }}>
        <ServiceDetail service={service} />
      </HostPropsProvider>
    </MemoryRouter>,
  );
}

const reload = jest.fn();

describe('ServiceDetail', () => {
  it('shows what the service is, who can use it, what you need and the steps', () => {
    renderDetail({ status: 'success', data: dogLicence, reload });
    expect(
      screen.getByRole('heading', { level: 1, name: 'Renew a dog licence' }),
    ).toBeInTheDocument();
    expect(screen.getByText('SGD 15.00')).toBeInTheDocument();
    expect(
      screen.getByRole('region', { name: 'Who can use it' }),
    ).toHaveTextContent('registered owner');
    expect(screen.getByRole('region', { name: 'Steps' })).toHaveTextContent(
      'Sign inPay the licence fee',
    );
    expect(
      screen.getByRole('link', { name: 'Back to all services' }),
    ).toHaveAttribute('href', '/services');
  });

  it('shows loading', () => {
    renderDetail({ status: 'loading', reload });
    expect(screen.getByRole('status')).toHaveTextContent('Loading…');
  });

  it('handles unknown services and errors', async () => {
    const { unmount } = renderDetail({ status: 'success', data: null, reload });
    expect(
      screen.getByRole('heading', { name: 'Service not found' }),
    ).toBeInTheDocument();
    unmount();
    renderDetail({
      status: 'error',
      error: new Error('500 Internal Server Error'),
      reload,
    });
    expect(screen.getByRole('alert')).toHaveTextContent(
      '500 Internal Server Error',
    );
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(reload).toHaveBeenCalledTimes(1);
  });
});
