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
  it('is a named radiogroup of Base UI radios', () => {
    render(
      <RadioGroup
        label="How should we contact you?"
        hint="Choose one"
        options={options}
        defaultValue="email"
        required
      />,
    );
    // Base UI: role="radiogroup" (was a <fieldset>, role "group"), named by its legend.
    const group = screen.getByRole('radiogroup', {
      name: 'How should we contact you? (required)',
    });
    expect(group).toHaveAccessibleDescription('Choose one');
    expect(screen.getByRole('radio', { name: 'Email' })).toBeChecked();
    expect(
      screen.getByRole('radio', { name: 'Phone' }),
    ).toHaveAccessibleDescription('Weekdays only');
    // role="radio" is a <span>: disabled is aria-disabled; the hidden native radios share a name
    expect(screen.getByRole('radio', { name: 'Post' })).toHaveAttribute(
      'aria-disabled',
      'true',
    );
    const names = [...document.querySelectorAll('input[type="radio"]')].map(
      (r) => r.getAttribute('name'),
    );
    expect(names).toHaveLength(3);
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
    expect(screen.getByRole('radiogroup')).toHaveAccessibleDescription(
      'Error: Pick one',
    );
  });

  it('one tab stop, arrow keys select, value submitted with the form', async () => {
    const user = userEvent.setup();
    const { container } = render(
      <form>
        <RadioGroup
          label="Contact"
          name="contact"
          options={[...options, { value: 'sms', label: 'SMS' }]}
          defaultValue="email"
        />
        <button type="submit">Send</button>
      </form>,
    );
    const form = container.querySelector('form') as HTMLFormElement;
    expect(new FormData(form).get('contact')).toBe('email');
    await user.tab();
    expect(screen.getByRole('radio', { name: 'Email' })).toHaveFocus();
    await user.keyboard('{ArrowDown}');
    expect(screen.getByRole('radio', { name: 'Phone' })).toBeChecked();
    await user.keyboard('{ArrowDown}'); // skips the disabled "Post"
    expect(screen.getByRole('radio', { name: 'SMS' })).toHaveFocus();
    expect(new FormData(form).get('contact')).toBe('sms');
    await user.tab();
    expect(screen.getByRole('button', { name: 'Send' })).toHaveFocus();
    expect(document.querySelectorAll('style')).toHaveLength(0);
  });
});
