import type { Profile } from '../types/profile';

export const profile: Profile = {
  id: 'mock-user-1',
  name: 'Dev User (mock)',
  email: 'dev.user@example.org',
  mobile: '+65 9123 4567',
  address: {
    line1: 'Block 123 Riverside Avenue 4',
    line2: '#05-67',
    postalCode: '560123',
  },
  memberSince: '2021-04-12',
  preferences: { emailUpdates: true, smsReminders: false },
};
