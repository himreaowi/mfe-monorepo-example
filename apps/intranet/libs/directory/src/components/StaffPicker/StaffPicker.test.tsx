import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HostPropsProvider } from '@org/mf-runtime/remote';
import { searchStaff } from '../../api/staffApi';
import type { StaffSummary } from '../../types/staff';
import { StaffPicker } from './StaffPicker';

jest.mock('../../api/staffApi');

const ann: StaffSummary = {
  id: 's-1',
  name: 'Ann Lee',
  jobTitle: 'Engineer',
  department: 'Technology',
  location: 'Level 3',
  email: 'ann.lee@example.org',
  phone: '+65 6555 0001',
};
const ben: StaffSummary = {
  ...ann,
  id: 's-2',
  name: 'Ben Tan',
  jobTitle: 'Analyst',
  email: 'ben.tan@example.org',
};

function Harness({
  onSelect,
  initial = null,
  department,
  error,
}: {
  onSelect: (person: StaffSummary | null) => void;
  initial?: StaffSummary | null;
  department?: string;
  error?: string;
}) {
  const [value, setValue] = useState<StaffSummary | null>(initial);
  return (
    <StaffPicker
      label="Covering colleague"
      value={value}
      department={department}
      error={error}
      onSelect={(person) => {
        setValue(person);
        onSelect(person);
      }}
    />
  );
}

function renderPicker(props: Parameters<typeof Harness>[0]) {
  const user = userEvent.setup();
  render(
    <HostPropsProvider
      value={{
        embedded: true,
        basePath: '/x',
        settings: { apiBaseUrl: 'https://api.test' },
      }}
    >
      <Harness {...props} />
    </HostPropsProvider>,
  );
  return user;
}

beforeEach(() => {
  jest.mocked(searchStaff).mockReset();
  jest
    .mocked(searchStaff)
    .mockResolvedValue({ items: [ann, ben], total: 2, departments: [] });
});

describe('StaffPicker', () => {
  it('is a collapsed combobox that does not search before typing', () => {
    renderPicker({ onSelect: jest.fn() });
    const input = screen.getByRole('combobox', { name: 'Covering colleague' });
    expect(input).toHaveAttribute('aria-expanded', 'false');
    expect(input).toHaveAttribute('aria-controls');
    expect(searchStaff).not.toHaveBeenCalled();
  });

  it('searches after typing, lists the results and chooses with the keyboard', async () => {
    const onSelect = jest.fn();
    const user = renderPicker({ onSelect, department: 'Technology' });
    const input = screen.getByRole('combobox');
    await user.type(input, 'ann');
    expect(await screen.findAllByRole('option')).toHaveLength(2);
    expect(searchStaff).toHaveBeenCalledTimes(1);
    expect(searchStaff).toHaveBeenCalledWith(
      expect.anything(),
      { q: 'ann', department: 'Technology' },
      expect.any(AbortSignal),
    );
    expect(input).toHaveAttribute('aria-expanded', 'true');
    expect(input).not.toHaveAttribute('aria-activedescendant');

    await user.keyboard('{ArrowDown}');
    const options = screen.getAllByRole('option');
    expect(options[0]).toHaveAttribute('aria-selected', 'true');
    expect(input).toHaveAttribute('aria-activedescendant', options[0].id);
    await user.keyboard('{ArrowDown}');
    expect(input).toHaveAttribute('aria-activedescendant', options[1].id);
    await user.keyboard('{ArrowUp}{ArrowUp}'); // wraps to the last
    expect(input).toHaveAttribute('aria-activedescendant', options[1].id);

    await user.keyboard('{Enter}');
    expect(onSelect).toHaveBeenCalledWith(ben);
    expect(
      screen.getByRole('textbox', { name: /Covering colleague/ }),
    ).toHaveValue('Ben Tan');
    expect(screen.getByText('Analyst, Technology')).toBeInTheDocument();
  });

  it('chooses with the mouse', async () => {
    const onSelect = jest.fn();
    const user = renderPicker({ onSelect });
    await user.type(screen.getByRole('combobox'), 'a');
    await user.click(await screen.findByRole('option', { name: /Ann Lee/ }));
    expect(onSelect).toHaveBeenCalledWith(ann);
  });

  it('closes the list with Escape and keeps nothing chosen', async () => {
    const onSelect = jest.fn();
    const user = renderPicker({ onSelect });
    const input = screen.getByRole('combobox');
    await user.type(input, 'ann');
    await screen.findAllByRole('option');
    await user.keyboard('{Escape}');
    expect(input).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('option')).not.toBeInTheDocument();
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('does not choose with Enter before an option is highlighted', async () => {
    const onSelect = jest.fn();
    const user = renderPicker({ onSelect });
    await user.type(screen.getByRole('combobox'), 'ann');
    await screen.findAllByRole('option');
    await user.keyboard('{Enter}');
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('says when no one matches', async () => {
    jest
      .mocked(searchStaff)
      .mockResolvedValue({ items: [], total: 0, departments: [] });
    const user = renderPicker({ onSelect: jest.fn() });
    await user.type(screen.getByRole('combobox'), 'zzz');
    expect(await screen.findByText('No one matches.')).toBeInTheDocument();
    expect(screen.getByRole('combobox')).toHaveAttribute(
      'aria-expanded',
      'false',
    );
  });

  it('shows the chosen person with a Clear button that returns to the search', async () => {
    const onSelect = jest.fn();
    const user = renderPicker({ onSelect, initial: ann });
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
    expect(screen.getByDisplayValue('Ann Lee')).toBeInTheDocument();
    await user.click(
      screen.getByRole('button', { name: 'Clear Covering colleague' }),
    );
    expect(onSelect).toHaveBeenCalledWith(null);
    expect(screen.getByRole('combobox')).toHaveFocus();
  });

  it('shows the error and the hint on the field', () => {
    renderPicker({ onSelect: jest.fn(), error: 'Choose a colleague' });
    expect(screen.getByRole('combobox')).toHaveAccessibleDescription(
      /Choose a colleague/,
    );
    expect(screen.getByRole('combobox')).toBeInvalid();
  });
});
