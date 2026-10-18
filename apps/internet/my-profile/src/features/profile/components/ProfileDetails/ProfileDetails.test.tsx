import { render, screen, within } from '@testing-library/react';
import { profile } from '../../__fixtures__/profile';
import { ProfileDetails } from './ProfileDetails';

describe('ProfileDetails', () => {
  it('shows the details in a region named by its heading', () => {
    render(<ProfileDetails profile={profile} />);
    const region = screen.getByRole('region', { name: 'Your details' });
    const details = within(region).getByTestId('profile-details');
    expect(details).toHaveTextContent('NameDev User (mock)');
    expect(details).toHaveTextContent('Emaildev.user@example.org');
    expect(details).toHaveTextContent('Mobile+65 9123 4567');
    expect(details).toHaveTextContent(
      'Mailing addressBlock 123 Riverside Avenue 4#05-67Singapore 560123',
    );
    expect(details).toHaveTextContent('Member sinceApril 2021');
    expect(region).toHaveTextContent('To change these details, contact us.');
  });

  it('leaves out an empty second address line', () => {
    render(
      <ProfileDetails
        profile={{
          ...profile,
          address: { line1: '1 Main Street', postalCode: '010001' },
        }}
      />,
    );
    expect(screen.getByTestId('profile-details')).toHaveTextContent(
      'Mailing address1 Main StreetSingapore 010001',
    );
  });

  it('shows an unparseable "member since" date as it came', () => {
    render(<ProfileDetails profile={{ ...profile, memberSince: 'unknown' }} />);
    expect(screen.getByTestId('profile-details')).toHaveTextContent(
      'Member sinceunknown',
    );
  });
});
