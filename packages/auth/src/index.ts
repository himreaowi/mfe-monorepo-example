// Makes the *.module.scss declarations visible to apps that type-check this package's source.
// eslint-disable-next-line @typescript-eslint/triple-slash-reference
/// <reference path="./styles.d.ts" />
export { AuthProvider, useAuth, type AuthProviderProps } from './AuthProvider';
export {
  RequireAuth,
  SignInPrompt,
  type RequireAuthProps,
} from './RequireAuth';
export { UserMenu } from './UserMenu';
export {
  createAuthClient,
  parseSessionBody,
  toAuthUser,
  DEFAULT_CSRF_HEADER,
  DEFAULT_RETURN_TO_PARAM,
  DEFAULT_TIMEOUT_MS,
  type CreateAuthClientOptions,
} from './client';
export { loadAuthClient } from './loadAuthClient';
export type {
  AuthClient,
  AuthContextValue,
  AuthError,
  AuthErrorCode,
  AuthSession,
  AuthStatus,
  AuthUser,
  BffAuthConfig,
  ManifestAuthConfig,
  SignInOptions,
} from './types';
