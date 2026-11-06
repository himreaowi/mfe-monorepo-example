/** One row of the staff search. */
export type StaffSummary = {
  id: string;
  name: string;
  jobTitle: string;
  department: string;
  location: string;
  email: string;
  phone: string;
};

export type StaffLink = { id: string; name: string };

/** A staff member's page. */
export type StaffMember = StaffSummary & {
  skills: string[];
  startDate: string;
  /** NRIC number (staff-only data). Show it only through `maskNric`, never in full. */
  nric?: string;
  manager: StaffLink | null;
  directReports: StaffLink[];
};

export type StaffSearchQuery = { q: string; department: string };

export type StaffSearchResult = {
  items: StaffSummary[];
  total: number;
  departments: string[];
};
