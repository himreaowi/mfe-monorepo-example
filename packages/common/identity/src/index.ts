/**
 * @org/common-identity (packages/common/identity): identifier rules for both zones (intranet
 * and internet): Singapore NRIC/FIN and UEN checks and the NRIC mask.
 *
 * Everything here ships to the internet portals: anyone can read it in the browser. No
 * confidential or intranet-only rules. The checks are fast feedback in forms, not protection:
 * the backend must enforce the same rules.
 * Imports only other packages/common/* and packages/platform/* packages, never zone code.
 */
export { isValidNric, maskNric, nricCheckLetter } from './nric/nric';
export { isValidUen } from './uen/uen';
