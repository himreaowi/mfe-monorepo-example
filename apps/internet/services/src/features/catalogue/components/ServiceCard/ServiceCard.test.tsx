import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { HostPropsProvider } from '@org/mf-runtime/remote';
import { dogLicence } from '../../__fixtures__/services';
import type { ServiceSummary } from '../../types/service';
import { ServiceCard } from './ServiceCard';

function renderCard(service: ServiceSummary) {
  return render(
    <MemoryRouter>
      <HostPropsProvider value={{ embedded: true, basePath: '/services' }}>
        <ul aria-label="Services">
          <ServiceCard service={service} />
        </ul>
      </HostPropsProvider>
    </MemoryRouter>,
  );
}

describe('ServiceCard', () => {
  it('links the title to the service page below the mount', () => {
    renderCard(dogLicence);
    const card = screen.getByTestId('service-card');
    expect(
      within(card).getByRole('heading', {
        level: 2,
        name: 'Renew a dog licence',
      }),
    ).toBeInTheDocument();
    expect(
      within(card).getByRole('link', { name: 'Renew a dog licence' }),
    ).toHaveAttribute('href', '/services/renew-dog-licence');
  });

  it('shows the summary, the agency, the fee and the channel', () => {
    renderCard(dogLicence);
    const card = screen.getByTestId('service-card');
    expect(card).toHaveTextContent(
      'Renew the yearly licence for a dog you own.',
    );
    expect(card).toHaveTextContent('Animal Services');
    expect(within(card).getByText('SGD 15.00')).toBeInTheDocument();
    expect(within(card).getByText('Online')).toBeInTheDocument();
  });

  it('says "In person" and "Free" for an offline service without a fee', () => {
    renderCard({ ...dogLicence, online: false, fee: null });
    expect(screen.getByText('Free')).toBeInTheDocument();
    expect(screen.getByText('In person')).toBeInTheDocument();
    expect(screen.queryByText('Online')).not.toBeInTheDocument();
  });
});
