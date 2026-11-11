/**
 * Sign-in for the whole portal, fixed at build time (written by `pnpm gen:shell
 * --sign-in-required [--sign-in-mode landing|redirect]`; this is your code now, edit it here).
 *
 * - `SIGN_IN_REQUIRED` false: the portal is open, remotes with `access: 'private'` ask for
 *   sign-in on their own route (RemotePage → RequireAuth).
 * - `SIGN_IN_REQUIRED` true: nothing of the portal (nav, remotes, remote code) is shown or
 *   downloaded before the session check says "signed in" (`SignInGate` from @org/auth, in
 *   src/app/App.tsx, with this shell's SignedOutLayout and LandingPage). Signed
 *   out, the header shows only the brand and `<main>` shows:
 *   - `landing`: src/pages/LandingPage (title, text, one "Sign in" button);
 *   - `redirect`: straight to the sign-in page (the landing page is the fallback when the BFF
 *     is unreachable, after a sign-out in this page, and when sign-in is not configured).
 *   Either way the user returns to the address first requested.
 *
 * No `auth` in the manifest (sign-in not configured): fails closed, the landing page says
 * sign-in is unavailable and the portal stays hidden.
 *
 * No globals in this file: the e2e suite (e2e/helpers.ts) imports it too.
 */
export type SignInMode = 'landing' | 'redirect';

export const SIGN_IN_REQUIRED = true as boolean;
export const SIGN_IN_MODE = 'landing' as SignInMode;

/** Landing page (src/pages/LandingPage). */
export const LANDING_TITLE = 'Business Portal';
export const LANDING_TEXT = 'Log in with Corppass to manage your business.';
export const LANDING_SIGN_IN_LABEL = 'Log in with Corppass';
/** Shown instead of the button when sign-in is not configured for this environment. */
export const LANDING_UNAVAILABLE_TEXT =
  'Sign-in is not configured for this environment.';
