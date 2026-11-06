import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RadioGroup } from './RadioGroup';

const options = [
  { value: 'email', label: 'Email' },
  { value: 'phone', label: 'Phone', hint: 'Weekdays only' },
  { value: 'post', label: 'Post', disabled: true },
];

describe('RadioGroup', () => {
  it('is a named group of native radios', () => {
    render(
      <RadioGroup
        label="How should we contact you?"
        hint="Choose one"
        options={options}
        defaultValue="email"
        required
      />,
    );
    const group = screen.getByRole('group', {
      name: 'How should we contact you? (required)',
    });
    expect(group.tagName).toBe('FIELDSET');
    expect(group).toHaveAccessibleDescription('Choose one');
    expect(screen.getByRole('radio', { name: 'Email' })).toBeChecked();
    expect(
      screen.getByRole('radio', { name: 'Phone' }),
    ).toHaveAccessibleDescription('Weekdays only');
    expect(screen.getByRole('radio', { name: 'Post' })).toBeDisabled();
    const names = screen
      .getAllByRole('radio')
      .map((r) => r.getAttribute('name'));
    expect(new Set(names).size).toBe(1);
  });

  it('controlled: reports the chosen value', async () => {
    const user = userEvent.setup();
    const onChange = jest.fn();
    function Controlled() {
      const [value, setValue] = useState('email');
      return (
        <RadioGroup
          label="Contact"
          name="contact"
          options={options}
          value={value}
          onChange={(next) => {
            onChange(next);
            setValue(next);
          }}
          error="Pick one"
          inline
        />
      );
    }
    render(<Controlled />);
    await user.click(screen.getByText('Phone'));
    expect(onChange).toHaveBeenCalledWith('phone');
    expect(screen.getByRole('radio', { name: 'Phone' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'Email' })).toHaveAttribute(
      'aria-invalid',
      'true',
    );
    expect(screen.getByRole('group')).toHaveAccessibleDescription(
      'Error: Pick one',
    );
  });
});
