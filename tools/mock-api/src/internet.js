// @ts-check
/**
 * DEV ONLY: mock APIs of the internet zone (Citizen Portal).
 *   GET /services?q=&category=      services catalogue           (services)
 *   GET /services/:slug             one service                  (services)
 *   GET /announcements              announcements, newest first  (announcements)
 *   GET /announcements/:id          one announcement             (announcements)
 *   GET /profile/me                 the signed-in user's profile (my-profile)
 *   PUT /profile/me/preferences     update notification choices  (my-profile, needs X-CSRF-Token)
 *
 * The real API identifies the user from the BFF session cookie. The mock has no session: it
 * answers for the dev mock user of @org/auth (`mock-user-1`) and checks the mock CSRF token that
 * the mock auth client hands out (`mock-csrf-token`).
 * Data is fictional and kept in memory (POST /api/__reset restores it).
 */
import { json, notFound } from './server.js';

/** @typedef {import('./server.js').ZoneApi} ZoneApi */

export const MOCK_CSRF_TOKEN = 'mock-csrf-token';

const SERVICES = [
  {
    slug: 'renew-dog-licence',
    title: 'Renew a dog licence',
    category: 'Pets and animals',
    agency: 'Animal Services',
    summary: 'Renew the yearly licence for a dog you own.',
    online: true,
    fee: { amount: 1500, currency: 'SGD' },
    processingTime: 'Immediate',
    description:
      'Every dog must have a valid licence. Renew it online before it expires to avoid a late fee.',
    eligibility: [
      'You are the registered owner of the dog',
      'The dog is microchipped',
    ],
    documents: ['Licence number', 'Microchip number'],
    steps: [
      'Sign in',
      'Check the dog’s details',
      'Pay the licence fee',
      'Download the licence',
    ],
  },
  {
    slug: 'apply-for-parking-permit',
    title: 'Apply for a residential parking permit',
    category: 'Transport',
    agency: 'Transport Office',
    summary: 'Get a season parking permit for the car park near your home.',
    online: true,
    fee: { amount: 8000, currency: 'SGD' },
    processingTime: '3 working days',
    description:
      'Residents can apply for a monthly season parking permit for one vehicle per household.',
    eligibility: [
      'You live at the address',
      'The vehicle is registered to you or a household member',
    ],
    documents: ['Vehicle registration number', 'Proof of address'],
    steps: [
      'Sign in',
      'Choose the car park',
      'Enter your vehicle details',
      'Pay the first month',
    ],
  },
  {
    slug: 'report-a-road-defect',
    title: 'Report a road defect',
    category: 'Transport',
    agency: 'Roads Department',
    summary: 'Tell us about potholes, damaged signs or broken street lights.',
    online: true,
    fee: null,
    processingTime: 'We reply within 5 working days',
    description:
      'Report a problem on a public road, footpath or street light. You do not need to sign in.',
    eligibility: ['Anyone can report a defect'],
    documents: ['Location of the defect', 'A photo (optional)'],
    steps: ['Describe the problem', 'Mark the location', 'Submit the report'],
  },
  {
    slug: 'book-community-hall',
    title: 'Book a community hall',
    category: 'Community',
    agency: 'Community Centres',
    summary: 'Book a hall or meeting room at a community centre.',
    online: true,
    fee: { amount: 4500, currency: 'SGD' },
    processingTime: 'Confirmed within 2 working days',
    description:
      'Halls and rooms can be booked up to 3 months ahead for private or community events.',
    eligibility: ['You are 18 or older'],
    documents: ['Event date and time', 'Expected number of guests'],
    steps: ['Choose a centre and room', 'Pick a date', 'Pay the deposit'],
  },
  {
    slug: 'register-a-birth',
    title: 'Register a birth',
    category: 'Family',
    agency: 'Registry Office',
    summary: 'Register your child’s birth within 42 days.',
    online: true,
    fee: null,
    processingTime: 'Immediate',
    description:
      'Parents must register a birth within 42 days. Online registration is free.',
    eligibility: ['You are a parent of the child'],
    documents: [
      'Hospital birth record number',
      'Parents’ marriage certificate (if any)',
    ],
    steps: [
      'Sign in',
      'Enter the child’s details',
      'Confirm the parents’ details',
      'Download the digital birth certificate',
    ],
  },
  {
    slug: 'apply-for-childcare-subsidy',
    title: 'Apply for a childcare subsidy',
    category: 'Family',
    agency: 'Family Support',
    summary: 'Get help with childcare fees at licensed centres.',
    online: true,
    fee: null,
    processingTime: '10 working days',
    description:
      'Working parents can get a monthly subsidy for children enrolled at a licensed childcare centre.',
    eligibility: [
      'Your child is enrolled at a licensed centre',
      'You work at least 56 hours a month',
    ],
    documents: ['Proof of employment', 'Enrolment letter'],
    steps: [
      'Sign in',
      'Fill in the application',
      'Upload documents',
      'Track the decision',
    ],
  },
  {
    slug: 'pay-a-parking-fine',
    title: 'Pay a parking fine',
    category: 'Transport',
    agency: 'Transport Office',
    summary: 'Pay a parking fine online with the notice number.',
    online: true,
    fee: { amount: 3000, currency: 'SGD' },
    processingTime: 'Immediate',
    description:
      'Pay before the due date shown on the notice. Late payment can increase the fine.',
    eligibility: ['You received a parking notice'],
    documents: ['Notice number', 'Vehicle registration number'],
    steps: ['Enter the notice number', 'Check the details', 'Pay'],
  },
  {
    slug: 'bulky-waste-collection',
    title: 'Request bulky waste collection',
    category: 'Housing and environment',
    agency: 'Environment Office',
    summary: 'Arrange collection of old furniture and large items.',
    online: true,
    fee: null,
    processingTime: 'Collected within 7 days',
    description:
      'Each household can request 2 free bulky waste collections a year.',
    eligibility: ['You live in a residential unit'],
    documents: ['Address', 'List of items'],
    steps: ['Sign in', 'List the items', 'Choose a collection date'],
  },
  {
    slug: 'library-membership',
    title: 'Get a library membership',
    category: 'Community',
    agency: 'Public Libraries',
    summary: 'Borrow books, e-books and use library spaces.',
    online: true,
    fee: null,
    processingTime: 'Immediate',
    description:
      'Membership is free for residents and lets you borrow up to 16 items at a time.',
    eligibility: ['You live in the city'],
    documents: ['Proof of address'],
    steps: ['Sign in', 'Confirm your details', 'Get your digital card'],
  },
  {
    slug: 'senior-health-screening',
    title: 'Book a senior health screening',
    category: 'Health',
    agency: 'Health Services',
    summary: 'Free yearly health screening for residents aged 60 and above.',
    online: false,
    fee: null,
    processingTime: 'Appointments within 4 weeks',
    description:
      'Screening covers blood pressure, blood sugar, cholesterol, vision and hearing.',
    eligibility: [
      'You are 60 or older',
      'You have not been screened in the last 12 months',
    ],
    documents: ['Identity document at the appointment'],
    steps: [
      'Call the hotline or visit a clinic',
      'Choose a time',
      'Attend the screening',
    ],
  },
];

/** @param {(typeof SERVICES)[number]} service */
function serviceSummary({
  slug,
  title,
  category,
  agency,
  summary,
  online,
  fee,
}) {
  return { slug, title, category, agency, summary, online, fee };
}

const ANNOUNCEMENTS = [
  {
    id: 'a-2026-031',
    title: 'Online services maintenance on 25 October',
    category: 'Service update',
    publishedAt: '2026-10-16T09:00:00+08:00',
    summary: 'Some online services will be unavailable from 1 am to 5 am.',
    body: [
      'We are upgrading our systems on Sunday 25 October 2026 from 1 am to 5 am.',
      'During this time you cannot sign in or make payments. Services that do not need sign-in, such as the services catalogue, stay available.',
      'We are sorry for any inconvenience.',
    ],
  },
  {
    id: 'a-2026-030',
    title: 'Dog licence fees unchanged for 2027',
    category: 'Fees',
    publishedAt: '2026-10-02T10:00:00+08:00',
    summary: 'The yearly dog licence fee stays at SGD 15.00.',
    body: [
      'The yearly dog licence fee will stay at SGD 15.00 in 2027.',
      'You can renew your dog licence online up to 30 days before it expires.',
    ],
  },
  {
    id: 'a-2026-029',
    title: 'New community hall opens in Riverside',
    category: 'Community',
    publishedAt: '2026-09-18T14:30:00+08:00',
    summary: 'The Riverside community hall can be booked from 1 November.',
    body: [
      'The new Riverside community hall has space for 200 guests, a kitchen and step-free access.',
      'Bookings open on 1 November 2026 through the "Book a community hall" service.',
    ],
  },
  {
    id: 'a-2026-028',
    title: 'Childcare subsidy: higher income ceiling',
    category: 'Family',
    publishedAt: '2026-09-01T08:00:00+08:00',
    summary: 'More families can now get a childcare subsidy.',
    body: [
      'From 1 September 2026, households earning up to SGD 12,000 a month can apply for the basic childcare subsidy.',
      'If you applied before and were not eligible, you can apply again.',
    ],
  },
  {
    id: 'a-2026-027',
    title: 'Report road defects with photos',
    category: 'Service update',
    publishedAt: '2026-08-12T11:00:00+08:00',
    summary: 'You can now add a photo when you report a road defect.',
    body: [
      'Adding a photo helps our crews find and fix the problem faster.',
      'Photos are deleted once the defect is fixed.',
    ],
  },
];

function seedProfile() {
  return {
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
}

/** @returns {ZoneApi} */
export function createInternetApi() {
  let profile = seedProfile();
  return {
    reset() {
      profile = seedProfile();
    },
    routes: [
      {
        method: 'GET',
        path: '/services',
        handler: ({ query }) => {
          const q = (query.get('q') ?? '').trim().toLowerCase();
          const category = query.get('category') ?? '';
          const items = SERVICES.filter(
            (s) =>
              (!category || s.category === category) &&
              (!q ||
                [s.title, s.summary, s.agency].some((f) =>
                  f.toLowerCase().includes(q),
                )),
          ).map(serviceSummary);
          const categories = [
            ...new Set(SERVICES.map((s) => s.category)),
          ].sort();
          return json(200, { items, total: items.length, categories });
        },
      },
      {
        method: 'GET',
        path: '/services/:slug',
        handler: ({ params }) => {
          const service = SERVICES.find((s) => s.slug === params.slug);
          return service
            ? json(200, service)
            : notFound('No service with this name');
        },
      },
      {
        method: 'GET',
        path: '/announcements',
        handler: () =>
          json(200, {
            items: ANNOUNCEMENTS.map(
              ({ id, title, category, publishedAt, summary }) => ({
                id,
                title,
                category,
                publishedAt,
                summary,
              }),
            ),
          }),
      },
      {
        method: 'GET',
        path: '/announcements/:id',
        handler: ({ params }) => {
          const item = ANNOUNCEMENTS.find((a) => a.id === params.id);
          return item
            ? json(200, item)
            : notFound('No announcement with this id');
        },
      },
      {
        method: 'GET',
        path: '/profile/me',
        handler: () => json(200, profile),
      },
      {
        method: 'PUT',
        path: '/profile/me/preferences',
        handler: ({ body, headers }) => {
          if (headers['x-csrf-token'] !== MOCK_CSRF_TOKEN) {
            return json(403, { message: 'Missing or invalid CSRF token' });
          }
          const input = /** @type {Record<string, unknown>} */ (
            typeof body === 'object' && body !== null ? body : {}
          );
          if (
            typeof input.emailUpdates !== 'boolean' ||
            typeof input.smsReminders !== 'boolean'
          ) {
            return json(422, {
              message: 'Check your preferences',
              errors: {
                preferences:
                  'emailUpdates and smsReminders must be true or false',
              },
            });
          }
          profile = {
            ...profile,
            preferences: {
              emailUpdates: input.emailUpdates,
              smsReminders: input.smsReminders,
            },
          };
          return json(200, profile);
        },
      },
    ],
  };
}
