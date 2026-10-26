// @ts-check
/**
 * DEV ONLY: mock APIs of the intranet zone (Staff Portal).
 *   GET  /staff?q=&department=     staff search          (staff-directory)
 *   GET  /staff/:id                one staff member      (staff-directory; includes the fictional NRIC)
 *   GET  /leave/balance            leave balance         (leave-requests)
 *   GET  /leave/requests           my leave requests     (leave-requests)
 *   POST /leave/requests           submit a request      (leave-requests, 422 with field errors;
 *                                  optional coverId = a staff id, answered as cover: { id, name })
 *   GET  /helpdesk/tickets         vendor helpdesk API   (it-helpdesk vendor module)
 *   GET  /helpdesk/tickets/:id
 *   POST /helpdesk/tickets
 * Data is fictional and kept in memory (POST /api/__reset restores it).
 */
import { countWorkingDays, daysAgo, isIsoDate } from './dates.js';
import { json, notFound } from './server.js';

/** @typedef {import('./server.js').MockResource} ZoneApi */

/**
 * A fictional but valid NRIC for the demo staff: S + 7 digits + check letter (weights
 * 2,7,6,5,4,3,2; sum mod 11; letters JZIHGFEDCBA).
 * @param {number} index
 */
function fictionalNric(index) {
  const digits = String(8000000 + index * 7919).padStart(7, '0');
  const weights = [2, 7, 6, 5, 4, 3, 2];
  const sum = weights.reduce((total, w, i) => total + w * Number(digits[i]), 0);
  return `S${digits}${'JZIHGFEDCBA'[sum % 11]}`;
}

const STAFF = [
  [
    's-1001',
    'Aisha Rahman',
    'Director, Digital Services',
    'Digital Services',
    'Level 12, Tower A',
    null,
    ['Strategy', 'Service design'],
  ],
  [
    's-1002',
    'Benjamin Tan',
    'Lead Engineer',
    'Digital Services',
    'Level 12, Tower A',
    's-1001',
    ['React', 'Module Federation', 'Accessibility'],
  ],
  [
    's-1003',
    'Chloe Ng',
    'Frontend Engineer',
    'Digital Services',
    'Level 12, Tower A',
    's-1002',
    ['TypeScript', 'Testing'],
  ],
  [
    's-1004',
    'Daniel Lim',
    'Backend Engineer',
    'Digital Services',
    'Level 12, Tower A',
    's-1002',
    ['Java', 'APIs'],
  ],
  [
    's-1005',
    'Evelyn Goh',
    'UX Researcher',
    'Digital Services',
    'Level 11, Tower A',
    's-1001',
    ['Usability testing', 'Interviews'],
  ],
  [
    's-1006',
    'Farid Hassan',
    'Product Manager',
    'Digital Services',
    'Level 11, Tower A',
    's-1001',
    ['Roadmaps', 'Agile'],
  ],
  [
    's-1007',
    'Grace Lee',
    'Head of People',
    'People & Culture',
    'Level 8, Tower B',
    null,
    ['Talent', 'Policy'],
  ],
  [
    's-1008',
    'Harish Kumar',
    'HR Business Partner',
    'People & Culture',
    'Level 8, Tower B',
    's-1007',
    ['Employee relations'],
  ],
  [
    's-1009',
    'Irene Chua',
    'Learning Specialist',
    'People & Culture',
    'Level 8, Tower B',
    's-1007',
    ['Training', 'Coaching'],
  ],
  [
    's-1010',
    'Jason Ong',
    'Payroll Officer',
    'People & Culture',
    'Level 8, Tower B',
    's-1007',
    ['Payroll', 'Leave administration'],
  ],
  [
    's-1011',
    'Kavitha Raj',
    'Chief Financial Officer',
    'Finance',
    'Level 15, Tower A',
    null,
    ['Budgeting', 'Governance'],
  ],
  [
    's-1012',
    'Liam Teo',
    'Finance Analyst',
    'Finance',
    'Level 15, Tower A',
    's-1011',
    ['Forecasting', 'Excel'],
  ],
  [
    's-1013',
    'Mei Ling Koh',
    'Procurement Officer',
    'Finance',
    'Level 14, Tower A',
    's-1011',
    ['Tenders', 'Contracts'],
  ],
  [
    's-1014',
    'Nur Aisyah Binte Ahmad',
    'Accounts Executive',
    'Finance',
    'Level 14, Tower A',
    's-1011',
    ['Accounts payable'],
  ],
  [
    's-1015',
    'Oliver Chan',
    'IT Operations Manager',
    'Technology',
    'Level 3, Tower B',
    null,
    ['Infrastructure', 'Service desk'],
  ],
  [
    's-1016',
    'Priya Nair',
    'Security Engineer',
    'Technology',
    'Level 3, Tower B',
    's-1015',
    ['Security', 'Identity'],
  ],
  [
    's-1017',
    'Qi Hui Wong',
    'Service Desk Analyst',
    'Technology',
    'Level 3, Tower B',
    's-1015',
    ['Laptops', 'Accounts'],
  ],
  [
    's-1018',
    'Ravi Shankar',
    'Network Engineer',
    'Technology',
    'Level 3, Tower B',
    's-1015',
    ['Networks', 'Wi-Fi'],
  ],
  [
    's-1019',
    'Siti Nurhaliza',
    'Communications Lead',
    'Corporate Communications',
    'Level 10, Tower A',
    null,
    ['Media', 'Writing'],
  ],
  [
    's-1020',
    'Thomas Yeo',
    'Content Designer',
    'Corporate Communications',
    'Level 10, Tower A',
    's-1019',
    ['Plain language', 'Content'],
  ],
  [
    's-1021',
    'Umar Malik',
    'Designer',
    'Corporate Communications',
    'Level 10, Tower A',
    's-1019',
    ['Visual design', 'Illustration'],
  ],
  [
    's-1022',
    'Valerie Sim',
    'Legal Counsel',
    'Legal',
    'Level 16, Tower A',
    null,
    ['Contracts', 'Data protection'],
  ],
  [
    's-1023',
    'Wei Jie Ho',
    'Data Protection Officer',
    'Legal',
    'Level 16, Tower A',
    's-1022',
    ['PDPA', 'Privacy'],
  ],
  [
    's-1024',
    'Xin Yi Low',
    'Office Manager',
    'Facilities',
    'Level 1, Tower B',
    null,
    ['Workplace', 'Events'],
  ],
].map(
  ([id, name, jobTitle, department, location, managerId, skills], index) => {
    const handle = String(name)
      .toLowerCase()
      .replace(/[^a-z ]/g, '')
      .split(' ')
      .filter(Boolean);
    return {
      id: /** @type {string} */ (id),
      name: /** @type {string} */ (name),
      jobTitle: /** @type {string} */ (jobTitle),
      department: /** @type {string} */ (department),
      location: /** @type {string} */ (location),
      email: `${handle[0]}.${handle[handle.length - 1]}@example.org`,
      phone: `+65 6555 ${String(1001 + index * 7).padStart(4, '0')}`,
      managerId: /** @type {string | null} */ (managerId),
      skills: /** @type {string[]} */ (skills),
      startDate: `20${String(10 + (index % 14)).padStart(2, '0')}-0${(index % 9) + 1}-01`,
      nric: fictionalNric(index),
    };
  },
);

/** @param {(typeof STAFF)[number]} member */
function staffSummary({
  id,
  name,
  jobTitle,
  department,
  location,
  email,
  phone,
}) {
  return { id, name, jobTitle, department, location, email, phone };
}

export const LEAVE_TYPES = [
  { type: 'annual', label: 'Annual leave', entitled: 18 },
  { type: 'sick', label: 'Sick leave', entitled: 14 },
  { type: 'childcare', label: 'Childcare leave', entitled: 6 },
  { type: 'unpaid', label: 'No-pay leave', entitled: null },
];
const MAX_REASON = 500;

/**
 * @typedef {{ id: string, type: string, startDate: string, endDate: string, days: number,
 *   reason: string, status: 'pending' | 'approved' | 'rejected', createdAt: string,
 *   cover?: { id: string, name: string } }} LeaveRequest
 * @typedef {{ id: string, category: string, priority: string, summary: string,
 *   description: string, status: 'open' | 'in-progress' | 'resolved', createdAt: string,
 *   updatedAt: string }} Ticket
 */

function seedLeave() {
  /** @type {Array<[string, string, string, string, LeaveRequest['status'], number]>} */
  const rows = [
    [
      'annual',
      '2026-03-09',
      '2026-03-13',
      'Family trip to Penang',
      'approved',
      230,
    ],
    [
      'sick',
      '2026-05-04',
      '2026-05-04',
      'Medical appointment',
      'approved',
      167,
    ],
    ['annual', '2026-07-20', '2026-07-21', 'Moving house', 'approved', 100],
    ['childcare', '2026-09-14', '2026-09-14', 'School event', 'rejected', 45],
    ['annual', '2026-12-21', '2026-12-24', 'Year-end break', 'pending', 3],
  ];
  return rows.map(([type, startDate, endDate, reason, status, age], index) => ({
    id: `LR-${String(index + 1).padStart(4, '0')}`,
    type,
    startDate,
    endDate,
    days: countWorkingDays(startDate, endDate),
    reason,
    status,
    createdAt: daysAgo(age),
  }));
}

/** @returns {Ticket[]} */
function seedTickets() {
  return [
    [
      'hardware',
      'normal',
      'Laptop battery drains quickly',
      'Battery lasts about an hour since the last update.',
      'in-progress',
      6,
    ],
    [
      'access',
      'high',
      'Cannot open the finance shared drive',
      'Access denied on \\\\fin-share\\reports since Monday.',
      'open',
      2,
    ],
    [
      'software',
      'low',
      'Install a screen reader for testing',
      'Need NVDA on my workstation for accessibility testing.',
      'resolved',
      20,
    ],
  ].map(([category, priority, summary, description, status, age], index) => ({
    id: `HD-${1040 + index}`,
    category: String(category),
    priority: String(priority),
    summary: String(summary),
    description: String(description),
    status: /** @type {Ticket['status']} */ (status),
    createdAt: daysAgo(Number(age)),
    updatedAt: daysAgo(Math.max(0, Number(age) - 1)),
  }));
}

/** @param {LeaveRequest[]} requests */
function balances(requests) {
  return LEAVE_TYPES.map(({ type, label, entitled }) => {
    const sum = (/** @type {LeaveRequest['status']} */ status) =>
      requests
        .filter((r) => r.type === type && r.status === status)
        .reduce((total, r) => total + r.days, 0);
    const taken = sum('approved');
    const pending = sum('pending');
    return {
      type,
      label,
      entitled,
      taken,
      pending,
      remaining: entitled === null ? null : entitled - taken - pending,
    };
  });
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

/** @param {unknown} body */
function validateLeave(body, /** @type {LeaveRequest[]} */ requests) {
  const input = /** @type {Record<string, unknown>} */ (
    typeof body === 'object' && body !== null ? body : {}
  );
  /** @type {Record<string, string>} */
  const errors = {};
  const type = LEAVE_TYPES.find((t) => t.type === input.type);
  if (!type) errors.type = 'Select a leave type';
  if (!isIsoDate(input.startDate))
    errors.startDate = 'Enter a valid start date';
  else if (input.startDate < todayIso())
    errors.startDate = 'The start date must be today or later';
  if (!isIsoDate(input.endDate)) errors.endDate = 'Enter a valid end date';
  const reason = typeof input.reason === 'string' ? input.reason.trim() : '';
  if (reason.length > MAX_REASON)
    errors.reason = `Reason must be ${MAX_REASON} characters or fewer`;
  let days = 0;
  if (!errors.startDate && !errors.endDate) {
    const start = /** @type {string} */ (input.startDate);
    const end = /** @type {string} */ (input.endDate);
    if (end < start)
      errors.endDate = 'The end date must be on or after the start date';
    else {
      days = countWorkingDays(start, end);
      if (days === 0)
        errors.endDate = 'Choose dates that include at least one working day';
    }
  }
  if (type && days > 0 && type.entitled !== null) {
    const remaining =
      balances(requests).find((b) => b.type === type.type)?.remaining ?? 0;
    if (days > remaining) {
      errors.endDate = `You have ${remaining} day${remaining === 1 ? '' : 's'} of ${type.label.toLowerCase()} left`;
    }
  }
  // optional covering colleague: the id of a staff member
  /** @type {{ id: string, name: string } | undefined} */
  let cover;
  if (
    input.coverId !== undefined &&
    input.coverId !== null &&
    input.coverId !== ''
  ) {
    const colleague = STAFF.find((s) => s.id === input.coverId);
    if (colleague) cover = { id: colleague.id, name: colleague.name };
    else errors.coverId = 'Choose a colleague from the list';
  }
  return { errors, days, reason, type: type?.type ?? '', cover };
}

/** @returns {ZoneApi} */
export function createIntranetApi() {
  let leave = seedLeave();
  let tickets = seedTickets();
  let nextLeave = leave.length + 1;
  let nextTicket = 1040 + tickets.length;

  return {
    reset() {
      leave = seedLeave();
      tickets = seedTickets();
      nextLeave = leave.length + 1;
      nextTicket = 1040 + tickets.length;
    },
    routes: [
      {
        method: 'GET',
        path: '/staff',
        handler: ({ query }) => {
          const q = (query.get('q') ?? '').trim().toLowerCase();
          const department = query.get('department') ?? '';
          const items = STAFF.filter(
            (s) =>
              (!department || s.department === department) &&
              (!q ||
                [s.name, s.jobTitle, s.department, ...s.skills].some((field) =>
                  field.toLowerCase().includes(q),
                )),
          ).map(staffSummary);
          const departments = [
            ...new Set(STAFF.map((s) => s.department)),
          ].sort();
          return json(200, { items, total: items.length, departments });
        },
      },
      {
        method: 'GET',
        path: '/staff/:id',
        handler: ({ params }) => {
          const member = STAFF.find((s) => s.id === params.id);
          if (!member) return notFound('No staff member with this id');
          const manager = STAFF.find((s) => s.id === member.managerId);
          const reports = STAFF.filter((s) => s.managerId === member.id);
          return json(200, {
            ...staffSummary(member),
            skills: member.skills,
            startDate: member.startDate,
            nric: member.nric,
            manager: manager ? { id: manager.id, name: manager.name } : null,
            directReports: reports.map((r) => ({ id: r.id, name: r.name })),
          });
        },
      },
      {
        method: 'GET',
        path: '/leave/balance',
        handler: () =>
          json(200, {
            year: new Date().getFullYear(),
            balances: balances(leave),
          }),
      },
      {
        method: 'GET',
        path: '/leave/requests',
        handler: () =>
          json(200, {
            items: [...leave].sort((a, b) =>
              b.createdAt.localeCompare(a.createdAt),
            ),
          }),
      },
      {
        method: 'POST',
        path: '/leave/requests',
        handler: ({ body }) => {
          const { errors, days, reason, type, cover } = validateLeave(
            body,
            leave,
          );
          if (Object.keys(errors).length > 0) {
            return json(422, { message: 'Check the leave request', errors });
          }
          const input = /** @type {{ startDate: string, endDate: string }} */ (
            body
          );
          /** @type {LeaveRequest} */
          const created = {
            id: `LR-${String(nextLeave).padStart(4, '0')}`,
            type,
            startDate: input.startDate,
            endDate: input.endDate,
            days,
            reason,
            status: 'pending',
            createdAt: new Date().toISOString(),
            ...(cover ? { cover } : {}),
          };
          nextLeave += 1;
          leave.push(created);
          return json(201, created);
        },
      },
      {
        method: 'GET',
        path: '/helpdesk/tickets',
        handler: () =>
          json(200, {
            items: [...tickets].sort((a, b) =>
              b.createdAt.localeCompare(a.createdAt),
            ),
          }),
      },
      {
        method: 'GET',
        path: '/helpdesk/tickets/:id',
        handler: ({ params }) => {
          const ticket = tickets.find((t) => t.id === params.id);
          return ticket
            ? json(200, ticket)
            : notFound('No ticket with this id');
        },
      },
      {
        method: 'POST',
        path: '/helpdesk/tickets',
        handler: ({ body }) => {
          const input = /** @type {Record<string, unknown>} */ (
            typeof body === 'object' && body !== null ? body : {}
          );
          /** @type {Record<string, string>} */
          const errors = {};
          const category = String(input.category ?? '');
          const priority = String(input.priority ?? 'normal');
          const summary =
            typeof input.summary === 'string' ? input.summary.trim() : '';
          const description =
            typeof input.description === 'string'
              ? input.description.trim()
              : '';
          if (!['hardware', 'software', 'access', 'other'].includes(category)) {
            errors.category = 'Choose a category';
          }
          if (!['low', 'normal', 'high'].includes(priority))
            errors.priority = 'Choose a priority';
          if (summary.length < 5)
            errors.summary = 'Enter a summary of at least 5 characters';
          if (summary.length > 120)
            errors.summary = 'Summary must be 120 characters or fewer';
          if (description.length > 2000)
            errors.description = 'Description is too long';
          if (Object.keys(errors).length > 0) {
            return json(422, { message: 'Check the ticket', errors });
          }
          const now = new Date().toISOString();
          /** @type {Ticket} */
          const ticket = {
            id: `HD-${nextTicket}`,
            category,
            priority,
            summary,
            description,
            status: 'open',
            createdAt: now,
            updatedAt: now,
          };
          nextTicket += 1;
          tickets.push(ticket);
          return json(201, ticket);
        },
      },
    ],
  };
}
