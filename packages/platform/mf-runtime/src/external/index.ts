// External/vendor modules: the mount contract and the host-side <ExternalModule>.
// The contract types are also shipped to vendors in @org/vendor-kit (mount-contract.d.ts).
export {
  EXTERNAL_EVENTS,
  MOUNT_CONTRACT_VERSION,
  isCompatibleContractVersion,
  type ExternalModuleElement,
  type ExternalModuleError,
  type ExternalModuleExports,
  type ExternalNavigateOptions,
  type ExternalTheme,
  type ExternalUser,
  type MountedModule,
  type MountFunction,
  type MountProps,
} from './contract';
export {
  validateExternalModuleConfig,
  type ExternalModuleConfig,
  type ExternalModuleConfigValidation,
  type ExternalModuleFormat,
} from './config';
export {
  DEFAULT_EXTERNAL_TIMEOUT_MS,
  ExternalModuleLoadError,
  loadExternalModule,
  toExternalModule,
  webComponentMount,
  withTimeout,
  type ExternalErrorCode,
  type LoadExternalModuleOptions,
} from './load';
export { loadMfExternalModule } from './loadMf';
export {
  ExternalModule,
  type ExternalModuleLoader,
  type ExternalModuleProps,
  type ExternalModuleReportedError,
} from './ExternalModule';
