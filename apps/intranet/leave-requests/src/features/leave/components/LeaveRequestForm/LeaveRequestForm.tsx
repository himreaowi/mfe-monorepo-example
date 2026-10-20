import { useId, useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import { useRemotePath } from '@org/mf-runtime/remote';
import { Button, RemoteFallback } from '@org/ui';
import type { ApiResult, SubmitResult } from '@org/use-api';
import { routePaths } from '@/core/constants/routePaths';
import { LeaveValidationError } from '../../api/leaveApi';
import type {
  LeaveBalance,
  LeaveBalances,
  LeaveField,
  LeaveFieldErrors,
  LeaveRequest,
  LeaveRequestInput,
  LeaveType,
} from '../../types/leave';
import { countWorkingDays, formatDays, todayIso } from '../../utils/dates';
import { MAX_REASON_LENGTH, validateLeave } from '../../utils/validateLeave';
import type { LeaveOverviewState } from '../LeaveOverview/LeaveOverview';
import { Field } from './Field';
import styles from './LeaveRequestForm.module.scss';

const EMPTY: LeaveRequestInput = {
  type: '',
  startDate: '',
  endDate: '',
  reason: '',
};

/** Order of the fields, for the error summary. */
const FIELD_ORDER: LeaveField[] = ['type', 'startDate', 'endDate', 'reason'];

function balanceLabel(balance: LeaveBalance): string {
  return balance.remaining === null
    ? balance.label
    : `${balance.label} (${formatDays(balance.remaining)} left)`;
}

/**
 * New leave request. Validates on submit (and against the balance), shows an error summary
 * that takes focus and links to each field; the API's 422 field errors are shown the same way.
 * It loads and sends nothing itself: the page passes the balance (`useLeaveBalance()`) and the
 * save (`useSubmitLeaveRequest()`); the form keeps only its own UI state.
 */
export function LeaveRequestForm({
  balance,
  save,
}: {
  balance: ApiResult<LeaveBalances>;
  save: SubmitResult<LeaveRequestInput, LeaveRequest>;
}) {
  const toPath = useRemotePath();
  const navigate = useNavigate();
  const [values, setValues] = useState<LeaveRequestInput>(EMPTY);
  const [errors, setErrors] = useState<LeaveFieldErrors>({});
  const [sendError, setSendError] = useState('');
  const summaryRef = useRef<HTMLDivElement>(null);
  const idPrefix = useId();
  const ids: Record<LeaveField, string> = {
    type: `${idPrefix}-type`,
    startDate: `${idPrefix}-start`,
    endDate: `${idPrefix}-end`,
    reason: `${idPrefix}-reason`,
  };
  const balances = balance.status === 'success' ? balance.data.balances : [];
  const today = todayIso();
  const days = countWorkingDays(values.startDate, values.endDate);
  const errorList = FIELD_ORDER.filter((field) => errors[field]);
  const submitting = save.state.status === 'submitting';

  const set = (field: LeaveField, value: string) =>
    setValues((current) => ({ ...current, [field]: value }));

  const showErrors = (next: LeaveFieldErrors) => {
    setErrors(next);
    // after React rendered the summary
    requestAnimationFrame(() => summaryRef.current?.focus());
  };

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSendError('');
    const found = validateLeave(values, balances, today);
    if (Object.keys(found).length > 0) {
      showErrors(found);
      return;
    }
    setErrors({});
    const outcome = await save.submit(values);
    if (outcome.ok) {
      const state: LeaveOverviewState = { created: outcome.data };
      navigate(toPath(routePaths.overview), { state });
    } else if (outcome.error instanceof LeaveValidationError) {
      showErrors(outcome.error.errors);
    } else if (!outcome.aborted) {
      setSendError(
        `Your request could not be sent (${outcome.error.message}). Try again.`,
      );
    }
  };

  if (balance.status === 'error') {
    return (
      <RemoteFallback
        title="Could not load your leave balance"
        reason={balance.error.message}
        onRetry={balance.reload}
      />
    );
  }

  return (
    <form
      className={styles.form}
      noValidate
      onSubmit={onSubmit}
      aria-labelledby="leave-form-title"
      data-testid="leave-form"
    >
      <h2 id="leave-form-title" className={styles.visuallyHidden}>
        Leave details
      </h2>
      {errorList.length > 0 ? (
        <div
          ref={summaryRef}
          className={styles.summary}
          role="alert"
          tabIndex={-1}
          aria-labelledby={`${idPrefix}-summary`}
          data-testid="error-summary"
        >
          <h2 id={`${idPrefix}-summary`}>There is a problem</h2>
          <ul>
            {errorList.map((field) => (
              <li key={field}>
                <a
                  href={`#${ids[field]}`}
                  onClick={(event) => {
                    event.preventDefault();
                    document.getElementById(ids[field])?.focus();
                  }}
                >
                  {errors[field]}
                </a>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <Field id={ids.type} label="Leave type" error={errors.type}>
        {(describedBy) => (
          <select
            id={ids.type}
            value={values.type}
            aria-describedby={describedBy}
            aria-invalid={errors.type ? true : undefined}
            onChange={(event) => set('type', event.target.value as LeaveType)}
          >
            <option value="">
              {balance.status === 'loading'
                ? 'Loading…'
                : 'Choose a leave type'}
            </option>
            {balances.map((b) => (
              <option key={b.type} value={b.type}>
                {balanceLabel(b)}
              </option>
            ))}
          </select>
        )}
      </Field>

      <div className={styles.dates}>
        <Field
          id={ids.startDate}
          label="First day"
          hint="Today or later"
          error={errors.startDate}
        >
          {(describedBy) => (
            <input
              id={ids.startDate}
              type="date"
              min={today}
              value={values.startDate}
              aria-describedby={describedBy}
              aria-invalid={errors.startDate ? true : undefined}
              onChange={(event) => set('startDate', event.target.value)}
            />
          )}
        </Field>
        <Field
          id={ids.endDate}
          label="Last day"
          hint="Same as the first day for one day"
          error={errors.endDate}
        >
          {(describedBy) => (
            <input
              id={ids.endDate}
              type="date"
              min={values.startDate || today}
              value={values.endDate}
              aria-describedby={describedBy}
              aria-invalid={errors.endDate ? true : undefined}
              onChange={(event) => set('endDate', event.target.value)}
            />
          )}
        </Field>
      </div>
      <p className={styles.hint} aria-live="polite" data-testid="leave-days">
        {days > 0
          ? `${formatDays(days)} of leave (working days, Monday to Friday).`
          : ''}
      </p>

      <Field
        id={ids.reason}
        label="Reason (optional)"
        hint={`Up to ${MAX_REASON_LENGTH} characters. Your manager sees it.`}
        error={errors.reason}
      >
        {(describedBy) => (
          <textarea
            id={ids.reason}
            rows={3}
            value={values.reason}
            aria-describedby={describedBy}
            aria-invalid={errors.reason ? true : undefined}
            onChange={(event) => set('reason', event.target.value)}
          />
        )}
      </Field>

      {sendError ? (
        <p className={styles.error} role="alert">
          {sendError}
        </p>
      ) : null}
      <div className={styles.actions}>
        <Button type="submit" disabled={submitting}>
          {submitting ? 'Sending…' : 'Send request'}
        </Button>
        <Link to={toPath(routePaths.overview)}>Cancel</Link>
      </div>
    </form>
  );
}
