import { useId, useRef, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router';
import { StaffPicker, type StaffSummary } from '@org/intranet-directory';
import { useRemotePath } from '@org/mf-runtime/remote';
import {
  Alert,
  Button,
  DateField,
  Link,
  RemoteFallback,
  Select,
  TextArea,
} from '@org/ui';
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
import styles from './LeaveRequestForm.module.scss';

const EMPTY: LeaveRequestInput = {
  type: '',
  startDate: '',
  endDate: '',
  reason: '',
};
const NO_COVER: StaffSummary | null = null;

/** Order of the fields, for the error summary. */
const FIELD_ORDER: LeaveField[] = [
  'type',
  'startDate',
  'endDate',
  'coverId',
  'reason',
];

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
  const [cover, setCover] = useState(NO_COVER);
  const [errors, setErrors] = useState<LeaveFieldErrors>({});
  const [sendError, setSendError] = useState('');
  const summaryRef = useRef<HTMLDivElement>(null);
  const idPrefix = useId();
  const ids: Record<LeaveField, string> = {
    type: `${idPrefix}-type`,
    startDate: `${idPrefix}-start`,
    endDate: `${idPrefix}-end`,
    reason: `${idPrefix}-reason`,
    coverId: `${idPrefix}-cover`,
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
    const outcome = await save.submit(
      cover ? { ...values, coverId: cover.id } : values,
    );
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
        <Alert
          ref={summaryRef}
          variant="error"
          title="There is a problem"
          headingLevel={2}
          className={styles.summary}
          tabIndex={-1}
          data-testid="error-summary"
        >
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
        </Alert>
      ) : null}

      <Select
        id={ids.type}
        label="Leave type"
        error={errors.type}
        value={values.type}
        onChange={(event) => set('type', event.target.value as LeaveType)}
        placeholder={
          balance.status === 'loading' ? 'Loading…' : 'Choose a leave type'
        }
        options={balances.map((b) => ({
          value: b.type,
          label: balanceLabel(b),
        }))}
      />

      <div className={styles.dates}>
        <DateField
          id={ids.startDate}
          label="First day"
          hint="Today or later"
          error={errors.startDate}
          inputClassName={styles.date}
          min={today}
          value={values.startDate}
          onChange={(event) => set('startDate', event.target.value)}
        />
        <DateField
          id={ids.endDate}
          label="Last day"
          hint="Same as the first day for one day"
          error={errors.endDate}
          inputClassName={styles.date}
          min={values.startDate || today}
          value={values.endDate}
          onChange={(event) => set('endDate', event.target.value)}
        />
      </div>
      <p className={styles.hint} aria-live="polite" data-testid="leave-days">
        {days > 0
          ? `${formatDays(days)} of leave (working days, Monday to Friday).`
          : ''}
      </p>

      <StaffPicker
        id={ids.coverId}
        label="Covering colleague (optional)"
        hint="Search by name, job title or department."
        error={errors.coverId}
        value={cover}
        onSelect={setCover}
      />

      <TextArea
        id={ids.reason}
        label="Reason (optional)"
        hint={`Up to ${MAX_REASON_LENGTH} characters. Your manager sees it.`}
        error={errors.reason}
        rows={3}
        value={values.reason}
        onChange={(event) => set('reason', event.target.value)}
      />

      {sendError ? <Alert variant="error">{sendError}</Alert> : null}
      <div className={styles.actions}>
        <Button type="submit" loading={submitting}>
          {submitting ? 'Sending…' : 'Send request'}
        </Button>
        <Link to={toPath(routePaths.overview)}>Cancel</Link>
      </div>
    </form>
  );
}
