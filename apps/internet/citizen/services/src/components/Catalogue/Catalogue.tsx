import { useId } from 'react';
import { RemoteFallback, Select, TextField } from '@org/ui';
import type { CategoriesQuery, ServicesQuery } from '@/hooks/useCatalogue';
import type { CatalogueQuery } from '@/types/service';
import { ServiceCard } from '@/components/ServiceCard/ServiceCard';
import styles from './Catalogue.module.scss';

export type CatalogueProps = {
  /** Search text and topic (the page keeps them in the URL: `?q=&category=`). */
  query: CatalogueQuery;
  /** The user changed the search text or the topic. */
  onQueryChange: (key: keyof CatalogueQuery, value: string) => void;
  /** From `useServices()`, called by the page. */
  services: ServicesQuery;
  /** From `useCategories()`, called by the page. */
  categories: CategoriesQuery;
};

/**
 * Services catalogue with search and a category filter. Displays only: the page reads the
 * query from the URL, loads the services and the topics and passes them down
 * (docs/coding-conventions.md "Data fetching").
 */
export function Catalogue({
  query: { q, category },
  onQueryChange,
  services,
  categories,
}: CatalogueProps) {
  const searchId = useId();
  const categoryId = useId();

  const count =
    services.status === 'success' && !services.isPlaceholderData
      ? `${services.data.total} ${services.data.total === 1 ? 'service' : 'services'}`
      : services.status === 'pending' || services.isPlaceholderData
        ? 'Searching…'
        : '';

  return (
    <section className={styles.page} data-testid="catalogue">
      <h1 className={styles.title}>Services</h1>
      <p className={styles.lead}>
        Find a service, check who can use it and what you need.
      </p>
      <form
        className={styles.filters}
        role="search"
        aria-label="Services"
        onSubmit={(event) => event.preventDefault()}
      >
        <TextField
          id={searchId}
          className={styles.field}
          label="Search services"
          type="search"
          value={q}
          autoComplete="off"
          onChange={(event) => onQueryChange('q', event.target.value)}
        />
        <Select
          id={categoryId}
          className={styles.field}
          label="Topic"
          value={category}
          onChange={(event) => onQueryChange('category', event.target.value)}
          placeholder="All topics"
          options={
            categories.status === 'success'
              ? categories.data.map((name) => ({ value: name, label: name }))
              : []
          }
        />
      </form>
      <p className={styles.status} role="status" data-testid="service-count">
        {count}
      </p>
      {services.status === 'error' ? (
        <RemoteFallback
          title="Could not load the services"
          reason={services.error.message}
          onRetry={() => void services.refetch()}
        />
      ) : null}
      {services.status === 'success' && services.data.items.length === 0 ? (
        <p className={styles.muted}>
          No services match. Try other words or another topic.
        </p>
      ) : null}
      {services.status === 'success' && services.data.items.length > 0 ? (
        <ul className={styles.results} aria-label="Services">
          {services.data.items.map((service) => (
            <ServiceCard key={service.slug} service={service} />
          ))}
        </ul>
      ) : null}
    </section>
  );
}
