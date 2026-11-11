import { useSearchParams } from 'react-router';
import { Catalogue } from '@/components/Catalogue/Catalogue';
import { useCategories, useServices } from '@/hooks/useCatalogue';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { type CatalogueQuery } from '@/types/service';

/**
 * Page-level data fetching: the page reads the query from the URL (`?q=&category=`, so results
 * survive a reload and the back button), loads the services (250 ms after typing stops) and
 * the topics, and passes them to `Catalogue`, which only displays.
 */
export function OverviewPage() {
  const [params, setParams] = useSearchParams();
  const query: CatalogueQuery = {
    q: params.get('q') ?? '',
    category: params.get('category') ?? '',
  };
  const services = useServices({
    q: useDebouncedValue(query.q),
    category: query.category,
  });
  const categories = useCategories();

  const onQueryChange = (key: keyof CatalogueQuery, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next, { replace: true });
  };

  return (
    <div data-testid="overview-page">
      <Catalogue
        query={query}
        onQueryChange={onQueryChange}
        services={services}
        categories={categories}
      />
    </div>
  );
}
