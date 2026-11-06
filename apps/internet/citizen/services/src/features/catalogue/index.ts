// The catalogue feature's public API: what pages (and other features) may use.
export { Catalogue } from './components/Catalogue/Catalogue';
export { ServiceDetail } from './components/ServiceDetail/ServiceDetail';
// data hooks: called by pages, which pass the results down to the components
export { useCategories, useService, useServices } from './hooks/useCatalogue';
export { useDebouncedValue } from './hooks/useDebouncedValue';
export type { CatalogueQuery, Service, ServiceSummary } from './types/service';
