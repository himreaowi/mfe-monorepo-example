import { useId } from 'react';
import { RemoteFallback } from '@org/ui';
import type { ApiResult } from '@org/use-api';
import type { CatalogueQuery, CatalogueResult } from '../../types/service';
import { ServiceCard } from '../ServiceCard/ServiceCard';
import styles from './Catalogue.module.scss';

export type CatalogueProps = {
  /** Search text and topic (the page keeps them in the URL: `?q=&category=`). */
  query: CatalogueQuery;
  /** The user changed the search text or the topic. */
  onQueryChange: (key: keyof CatalogueQuery, value: string) => void;
  /** From `useServices()`, called by the page. */
  services: ApiResult<CatalogueResult>;
  /** From `useCategories()`, called by the page. */
  categories: ApiResult<string[]>;
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
    services.status === 'success'
      ? `${services.data.total} ${services.data.total === 1 ? 'service' : 'services'}`
      : services.status === 'loading'
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
        <div className={styles.field}>
          <label htmlFor={searchId}>Search services</label>
          <input
            id={searchId}
            type="search"
            value={q}
            autoComplete="off"
            onChange={(event) => onQueryChange('q', event.target.value)}
          />
        </div>
        <div className={styles.field}>
          <label htmlFor={categoryId}>Topic</label>
          <select
            id={categoryId}
            value={category}
            onChange={(event) => onQueryChange('category', event.target.value)}
          >
            <option value="">All topics</option>
            {categories.status === 'success'
              ? categories.data.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))
              : null}
          </select>
        </div>
      </form>
      <p className={styles.status} role="status" data-testid="service-count">
        {count}
      </p>
      {services.status === 'error' ? (
        <RemoteFallback
          title="Could not load the services"
          reason={services.error.message}
          onRetry={services.reload}
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
