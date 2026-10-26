// Remote-side API: what a remote uses to expose itself and read host props.
export {
  createRemoteApp,
  type CreateRemoteAppOptions,
  type ProviderComponent,
  type RemoteAppParts,
} from './createRemoteApp';
export { useApiClient } from './useApiClient';
export {
  HostPropsProvider,
  useHostProps,
  useRemotePath,
} from './HostPropsContext';
export {
  joinBasePath,
  normalizeBasePath,
  type HostProps,
  type HostUser,
} from '../hostProps';
