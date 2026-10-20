// The staff feature's public API: what pages (and other features) may use.
export { StaffSearch } from './components/StaffSearch/StaffSearch';
export { StaffDetail } from './components/StaffDetail/StaffDetail';
// data hooks: called by pages, which pass the results down to the components
export { useDebouncedValue } from './hooks/useDebouncedValue';
export { useDepartments } from './hooks/useDepartments';
export { useStaffMember } from './hooks/useStaffMember';
export { useStaffSearch } from './hooks/useStaffSearch';
export type {
  StaffMember,
  StaffSearchQuery,
  StaffSummary,
} from './types/staff';
