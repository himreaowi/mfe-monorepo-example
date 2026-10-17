import { HttpClientError, type HttpClient } from '@org/http-client';
import { apiRoutes } from '@/core/constants/apiRoutes';
import type {
  LeaveBalances,
  LeaveFieldErrors,
  LeaveRequest,
  LeaveRequestInput,
} from '../types/leave';

/** The API rejected the request with field errors (422). */
export class LeaveValidationError extends Error {
  readonly errors: LeaveFieldErrors;

  constructor(message: string, errors: LeaveFieldErrors) {
    super(message);
    this.name = 'LeaveValidationError';
    this.errors = errors;
  }
}

const FIELDS = ['type', 'startDate', 'endDate', 'reason'] as const;

/** Keep only known fields with string messages from an untrusted 422 body. */
function fieldErrors(body: unknown): LeaveFieldErrors {
  const raw =
    typeof body === 'object' && body !== null && 'errors' in body
      ? (body as { errors: unknown }).errors
      : undefined;
  const errors: LeaveFieldErrors = {};
  if (typeof raw !== 'object' || raw === null) return errors;
  for (const field of FIELDS) {
    const message = (raw as Record<string, unknown>)[field];
    if (typeof message === 'string') errors[field] = message;
  }
  return errors;
}

export async function getLeaveBalance(
  http: HttpClient,
  signal?: AbortSignal,
): Promise<LeaveBalances> {
  const result = await http.getJson<Partial<LeaveBalances>>(
    apiRoutes.leave.balance(),
    { signal },
  );
  return {
    year: result?.year ?? new Date().getFullYear(),
    balances: result?.balances ?? [],
  };
}

export async function getLeaveRequests(
  http: HttpClient,
  signal?: AbortSignal,
): Promise<LeaveRequest[]> {
  const result = await http.getJson<{ items?: LeaveRequest[] }>(
    apiRoutes.leave.requests(),
    { signal },
  );
  return result?.items ?? [];
}

/**
 * Submit a leave request. Throws `LeaveValidationError` with field errors on 422; other
 * failures throw the client's `HttpClientError`.
 */
export async function submitLeaveRequest(
  http: HttpClient,
  input: LeaveRequestInput,
  signal?: AbortSignal,
  headers?: Record<string, string>,
): Promise<LeaveRequest> {
  try {
    return await http.postJson<LeaveRequest>(
      apiRoutes.leave.requests(),
      { ...input, reason: input.reason.trim() },
      { signal, headers },
    );
  } catch (error) {
    if (error instanceof HttpClientError && error.status === 422) {
      throw new LeaveValidationError(
        'Check the leave request',
        fieldErrors(error.body),
      );
    }
    throw error;
  }
}
