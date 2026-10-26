/**
 * @org/intranet-directory (apps/intranet/libs/directory): the staff directory building blocks
 * shared by the intranet remotes: the staff search API client, its types and hooks, the
 * `StaffCard` list item and the `StaffPicker` search box.
 *
 * Never imported by the other zone or by packages/common. Imports only apps/intranet/libs/*,
 * packages/common/* and packages/platform/*, never a remote or shell.
 *
 * This file is the front door of the package: export here what the apps may use. Components
 * live in src/components/<Name>/ (<Name>.tsx, <Name>.module.scss, <Name>.test.tsx); move one out
 * of an app with pnpm move-component. See docs/where-code-goes.md.
 */
export { getDepartments, getStaffMember, searchStaff } from './api/staffApi';
export { useDebouncedValue } from './hooks/useDebouncedValue';
export { useStaffSearch } from './hooks/useStaffSearch';
export type {
  StaffLink,
  StaffMember,
  StaffSearchQuery,
  StaffSearchResult,
  StaffSummary,
} from './types/staff';
export * from './components/StaffCard/StaffCard';
export * from './components/StaffPicker/StaffPicker';
