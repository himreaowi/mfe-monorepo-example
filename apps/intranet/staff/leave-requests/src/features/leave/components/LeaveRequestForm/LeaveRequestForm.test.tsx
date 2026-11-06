import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { createFakeFetch } from '@org/jest-config/fetch';
import { HostPropsProvider } from '@org/mf-runtime/remote';
import { useSubmit, type ApiResult } from '@org/use-api';
import { LeaveValidationError } from '../../api/leaveApi';
import type {
  LeaveBalances,
  LeaveRequest,
  LeaveRequestInput,
} from '../../types/leave';
import { LeaveRequestForm } from './LeaveRequestForm';
import { balances, request } from '../../__fixtures__/leave';

/** What the page's `useSubmitLeaveRequest()` would send: a fake here (no API). */
const submitMock = jest.fn<Promise<LeaveRequest>, [LeaveRequestInput]>();
const reload = jest.fn();
const loadedBalance: ApiResult<LeaveBalances> = {
  status: 'success',
  data: balances,
  reload,
};

/** The form gets balance and save from the page; a real useSubmit gives it the same states. */
function Form({ balance }: { balance: ApiResult<LeaveBalances> }) {
  const save = useSubmit((input: LeaveRequestInput) => submitMock(input));
  return <LeaveRequestForm balance={balance} save={save} />;
}

function Overview() {
  const { state } = useLocation();
  return (
    <p data-testid="overview">
      {(state as { created?: { id: string } } | null)?.created?.id}
    </p>
  );
}

function renderForm(
  balance: ApiResult<LeaveBalances> = loadedBalance,
  settings?: Record<string, unknown>,
) {
  return render(
    <MemoryRouter initialEntries={['/leave/new']}>
      <HostPropsProvider
        value={{ embedded: true, basePath: '/leave', settings }}
      >
        <Routes>
          <Route path="/leave/new" element={<Form balance={balance} />} />
          <Route path="/leave" element={<Overview />} />
        </Routes>
      </HostPropsProvider>
    </MemoryRouter>,
  );
}

/** A Monday at least a week ahead, as yyyy-MM-dd. */
function nextMonday(): string {
  const date = new Date();
  date.setDate(date.getDate() + 7);
  while (date.getDay() !== 1) date.setDate(date.getDate() + 1);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

async function fillValid(user: ReturnType<typeof userEvent.setup>) {
  await user.selectOptions(
    screen.getByRole('combobox', { name: 'Leave type' }),
    'unpaid',
  );
  const monday = nextMonday();
  await user.type(screen.getByLabelText('First day'), monday);
  await user.type(screen.getByLabelText('Last day'), monday);
}

beforeEach(() => {
  submitMock.mockReset();
  reload.mockReset();
});

describe('LeaveRequestForm', () => {
  it('lists the leave types with what is left', async () => {
    renderForm();
    expect(
      await screen.findByRole('option', { name: 'Annual leave (7 days left)' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('option', { name: 'No-pay leave' }),
    ).toBeInTheDocument();
  });

  it('shows an error summary that takes focus and links to the fields', async () => {
    const user = userEvent.setup();
    renderForm();
    await screen.findByRole('option', { name: 'No-pay leave' });
    await user.click(screen.getByRole('button', { name: 'Send request' }));
    const summary = await screen.findByTestId('error-summary');
    await waitFor(() => expect(summary).toHaveFocus());
    expect(summary).toHaveAttribute('role', 'alert');
    expect(summary).toHaveTextContent('There is a problem');
    const typeSelect = screen.getByRole('combobox', { name: 'Leave type' });
    expect(typeSelect).toHaveAttribute('aria-invalid', 'true');
    expect(typeSelect).toHaveAccessibleDescription(
      'Error: Choose a leave type',
    );
    await user.click(screen.getByRole('link', { name: 'Enter a start date' }));
    expect(screen.getByLabelText('First day')).toHaveFocus();
    expect(submitMock).not.toHaveBeenCalled();
  });

  it('counts working days and sends a valid request, then goes to the overview', async () => {
    const user = userEvent.setup();
    submitMock.mockResolvedValue({ ...request, id: 'LR-0042' });
    renderForm();
    await screen.findByRole('option', { name: 'No-pay leave' });
    await fillValid(user);
    expect(screen.getByTestId('leave-days')).toHaveTextContent(
      '1 day of leave',
    );
    await user.type(screen.getByLabelText('Reason (optional)'), 'Moving');
    await user.click(screen.getByRole('button', { name: 'Send request' }));
    expect(await screen.findByTestId('overview')).toHaveTextContent('LR-0042');
    expect(submitMock).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'unpaid', reason: 'Moving' }),
    );
  });

  it('sends the covering colleague chosen with the keyboard as coverId', async () => {
    const user = userEvent.setup();
    globalThis.fetch = createFakeFetch({
      'GET /staff': {
        body: {
          items: [
            {
              id: 's-1003',
              name: 'Chloe Ng',
              jobTitle: 'Frontend Engineer',
              department: 'Digital Services',
              location: 'Level 12',
              email: 'chloe.ng@example.org',
              phone: '+65 6555 1013',
            },
          ],
          total: 1,
          departments: [],
        },
      },
    });
    submitMock.mockResolvedValue({ ...request, id: 'LR-0043' });
    renderForm(loadedBalance, { apiBaseUrl: 'https://api.test' });
    await screen.findByRole('option', { name: 'No-pay leave' });
    await fillValid(user);
    await user.type(
      screen.getByRole('combobox', { name: 'Covering colleague (optional)' }),
      'chloe',
    );
    await screen.findByRole('option', { name: /Chloe Ng/ });
    await user.keyboard('{ArrowDown}{Enter}');
    expect(screen.getByDisplayValue('Chloe Ng')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Send request' }));
    expect(await screen.findByTestId('overview')).toHaveTextContent('LR-0043');
    expect(submitMock).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'unpaid', coverId: 's-1003' }),
    );
    Reflect.deleteProperty(globalThis, 'fetch');
  });

  it('shows the API field errors (422) like its own', async () => {
    const user = userEvent.setup();
    submitMock.mockRejectedValue(
      new LeaveValidationError('Check', { endDate: 'You have 0 days left' }),
    );
    renderForm();
    await screen.findByRole('option', { name: 'No-pay leave' });
    await fillValid(user);
    await user.click(screen.getByRole('button', { name: 'Send request' }));
    expect(await screen.findByTestId('error-summary')).toHaveTextContent(
      'You have 0 days left',
    );
    expect(screen.getByLabelText('Last day')).toHaveAttribute(
      'aria-invalid',
      'true',
    );
  });

  it('shows a coverId error from the API on the covering colleague field', async () => {
    const user = userEvent.setup();
    submitMock.mockRejectedValue(
      new LeaveValidationError('Check', {
        coverId: 'Choose a colleague from the list',
      }),
    );
    renderForm();
    await screen.findByRole('option', { name: 'No-pay leave' });
    await fillValid(user);
    await user.click(screen.getByRole('button', { name: 'Send request' }));
    expect(await screen.findByTestId('error-summary')).toHaveTextContent(
      'Choose a colleague from the list',
    );
    expect(
      screen.getByRole('combobox', { name: 'Covering colleague (optional)' }),
    ).toBeInvalid();
  });

  it('reports other failures without losing the input', async () => {
    const user = userEvent.setup();
    submitMock.mockRejectedValue(new Error('503 Service Unavailable'));
    renderForm();
    await screen.findByRole('option', { name: 'No-pay leave' });
    await fillValid(user);
    await user.click(screen.getByRole('button', { name: 'Send request' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Your request could not be sent (503 Service Unavailable). Try again.',
    );
    expect(screen.getByRole('combobox', { name: 'Leave type' })).toHaveValue(
      'unpaid',
    );
  });

  it('says "Loading…" in the type list while the balance loads', () => {
    renderForm({ status: 'loading', reload });
    expect(
      screen.getByRole('option', { name: 'Loading…' }),
    ).toBeInTheDocument();
  });

  it('offers a retry when the balance cannot be loaded', async () => {
    renderForm({
      status: 'error',
      error: new Error('502 Bad Gateway'),
      reload,
    });
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Could not load your leave balance',
    );
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(reload).toHaveBeenCalledTimes(1);
  });
});
