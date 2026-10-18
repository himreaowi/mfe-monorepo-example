import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { HostPropsProvider } from '@org/mf-runtime/remote';
import {
  getLeaveBalance,
  LeaveValidationError,
  submitLeaveRequest,
} from '../../api';
import { LeaveRequestForm } from './LeaveRequestForm';
import { balances, request } from '../../__fixtures__/leave';

jest.mock('../../api', () => ({
  ...jest.requireActual('../../api'),
  getLeaveBalance: jest.fn(),
  submitLeaveRequest: jest.fn(),
}));

const submitMock = jest.mocked(submitLeaveRequest);

function Overview() {
  const { state } = useLocation();
  return (
    <p data-testid="overview">
      {(state as { created?: { id: string } } | null)?.created?.id}
    </p>
  );
}

function renderForm() {
  return render(
    <MemoryRouter initialEntries={['/leave/new']}>
      <HostPropsProvider value={{ embedded: true, basePath: '/leave' }}>
        <Routes>
          <Route path="/leave/new" element={<LeaveRequestForm />} />
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
  jest.mocked(getLeaveBalance).mockResolvedValue(balances);
  submitMock.mockReset();
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
      expect.anything(),
      expect.objectContaining({ type: 'unpaid', reason: 'Moving' }),
      expect.any(AbortSignal),
      undefined,
    );
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
});
