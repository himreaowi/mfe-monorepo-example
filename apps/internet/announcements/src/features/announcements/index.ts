// The announcements feature's public API: what pages (and other features) may use.
export { AnnouncementDetail } from './components/AnnouncementDetail/AnnouncementDetail';
export { AnnouncementList } from './components/AnnouncementList/AnnouncementList';
// data hooks: called by pages, which pass the results down to the components
export { useAnnouncement, useAnnouncements } from './hooks/useAnnouncements';
export type { Announcement, AnnouncementSummary } from './types/announcement';
