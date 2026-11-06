export type AnnouncementSummary = {
  id: string;
  title: string;
  category: string;
  /** ISO 8601 timestamp. */
  publishedAt: string;
  summary: string;
};

export type Announcement = AnnouncementSummary & {
  /** Plain-text paragraphs (never HTML). */
  body: string[];
};
