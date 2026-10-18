import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { HostPropsProvider } from '@org/mf-runtime/remote';
import { getService } from '../../api';
import { ServiceDetail } from './ServiceDetail';
import { dogLicence } from '../../__fixtures__/services';

jest.mock('../../api');
const getMock = jest.mocked(getService);

function renderDetail() {
  return render(
    <MemoryRouter>
      <HostPropsProvider value={{ embedded: true, basePath: '/services' }}>
        <ServiceDetail slug="renew-dog-licence" />
      </HostPropsProvider>
    </MemoryRouter>,
  );
}

describe('ServiceDetail', () => {
  it('shows what the service is, who can use it, what you need and the steps', async () => {
    getMock.mockResolvedValue(dogLicence);
    renderDetail();
    expect(
      await screen.findByRole('heading', {
        level: 1,
        name: 'Renew a dog licence',
      }),
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

  it('handles unknown services and errors', async () => {
    getMock.mockResolvedValueOnce(null);
    const { unmount } = renderDetail();
    expect(
      await screen.findByRole('heading', { name: 'Service not found' }),
    ).toBeInTheDocument();
    unmount();
    getMock.mockRejectedValueOnce(new Error('500 Internal Server Error'));
    renderDetail();
    expect(await screen.findByRole('alert')).toHaveTextContent(
      '500 Internal Server Error',
    );
  });
});
