import type { Money } from '@/core/utils/formatMoney';

export type ServiceSummary = {
  slug: string;
  title: string;
  category: string;
  agency: string;
  summary: string;
  /** Can be done online (otherwise in person or by phone). */
  online: boolean;
  fee: Money | null;
};

export type Service = ServiceSummary & {
  description: string;
  eligibility: string[];
  documents: string[];
  steps: string[];
  processingTime: string;
};

export type CatalogueQuery = { q: string; category: string };

export type CatalogueResult = {
  items: ServiceSummary[];
  total: number;
  categories: string[];
};
