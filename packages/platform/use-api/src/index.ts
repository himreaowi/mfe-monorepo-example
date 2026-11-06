export {
  toError,
  useApi,
  type ApiResult,
  type ApiState,
  type Loader,
} from './useApi';
export {
  useSubmit,
  type SubmitOutcome,
  type SubmitResult,
  type SubmitState,
} from './useSubmit';
// moved to @org/http-client; re-exported until the hooks are on TanStack Query
export { API_NOT_CONFIGURED, requireApiClient } from '@org/http-client';
