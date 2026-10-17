import type { Service } from '../types/service';

export const dogLicence: Service = {
  slug: 'renew-dog-licence',
  title: 'Renew a dog licence',
  category: 'Pets and animals',
  agency: 'Animal Services',
  summary: 'Renew the yearly licence for a dog you own.',
  online: true,
  fee: { amount: 1500, currency: 'SGD' },
  description: 'Every dog must have a valid licence.',
  eligibility: ['You are the registered owner of the dog'],
  documents: ['Licence number'],
  steps: ['Sign in', 'Pay the licence fee'],
  processingTime: 'Immediate',
};
