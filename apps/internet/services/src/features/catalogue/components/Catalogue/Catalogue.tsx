import { useId } from 'react';
import { useSearchParams } from 'react-router';
import { RemoteFallback } from '@org/ui';
import { useCategories, useServices } from '../../hooks/useCatalogue';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { ServiceCard } from '../ServiceCard/ServiceCard';
import styles from './Catalogue.module.scss';

/** Services catalogue with search and a category filter (query kept in the URL). */
export function Catalogue() {
  const [params, setParams] = useSearchParams();
  const q = params.get('q') ?? '';
  const category = params.get('category') ?? '';
  const services = useServices({ q: useDebouncedValue(q), category });
  const categories = useCategories();
  const searchId = useId();
  const categoryId = useId();

  const update = (key: 'q' | 'category', value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next, { replace: true });
  };

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
            onChange={(event) => update('q', event.target.value)}
          />
        </div>
        <div className={styles.field}>
          <label htmlFor={categoryId}>Topic</label>
          <select
            id={categoryId}
            value={category}
            onChange={(event) => update('category', event.target.value)}
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
