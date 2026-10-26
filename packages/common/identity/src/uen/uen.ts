import { normaliseId } from '../nric/nric';

/** Business registered with ACRA (ROB): 8 digits and a letter, e.g. `53012345K`. */
const BUSINESS = /^\d{8}[A-Z]$/;
/** Local company (ROC): year of registration (4 digits), 5 digits and a letter, e.g. `201912345K`. */
const LOCAL_COMPANY = /^\d{9}[A-Z]$/;
/** Other entities: T, S or R, 2-digit year, 2-letter entity type, 4 digits and a letter. */
const OTHER_ENTITY = /^[TSR]\d{2}[A-Z]{2}\d{4}[A-Z]$/;

/**
 * Is `value` shaped like a Singapore Unique Entity Number (UEN)?
 *
 * Checks the format only, for the three common shapes (business `nnnnnnnnX`, local company
 * `yyyynnnnnX`, other entities `TyyPQnnnnX` with T, S or R as the first letter). It does not
 * verify the check letter, the entity type code or that the UEN exists; the backend must do that
 * and must apply the same rules. Surrounding spaces and lower case are ignored.
 */
export function isValidUen(value: unknown): boolean {
  if (typeof value !== 'string') return false;
  const uen = normaliseId(value);
  return (
    BUSINESS.test(uen) || LOCAL_COMPANY.test(uen) || OTHER_ENTITY.test(uen)
  );
}
