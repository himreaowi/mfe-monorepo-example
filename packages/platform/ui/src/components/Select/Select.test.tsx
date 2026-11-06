import { createRef } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Select } from './Select';

const options = [
  { value: 'annual', label: 'Annual leave' },
  { value: 'sick', label: 'Sick leave' },
  { value: 'unpaid', label: 'Unpaid leave', disabled: true },
];

describe('Select', () => {
  it('is a labelled native select with options and a placeholder', async () => {
    const user = userEvent.setup();
    const onChange = jest.fn();
    const ref = createRef<HTMLSelectElement>();
    render(
      <Select
        ref={ref}
        label="Type"
        placeholder="Choose a type"
        options={options}
        onChange={(e) => onChange(e.target.value)}
      />,
    );
    const select = screen.getByRole('combobox', { name: 'Type' });
    expect(ref.current).toBe(select);
    expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual([
      'Choose a type',
      'Annual leave',
      'Sick leave',
      'Unpaid leave',
    ]);
    expect(screen.getByRole('option', { name: 'Unpaid leave' })).toBeDisabled();
    await user.selectOptions(select, 'sick');
    expect(onChange).toHaveBeenCalledWith('sick');
  });

  it('accepts option children and shows errors', () => {
    render(
      <Select label="Team" error="Choose a team" required>
        <option value="a">A</option>
      </Select>,
    );
    const select = screen.getByRole('combobox', { name: 'Team (required)' });
    expect(select).toHaveAttribute('aria-invalid', 'true');
    expect(select).toBeRequired();
  });
});
