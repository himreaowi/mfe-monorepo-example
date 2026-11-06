import { createRef } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Checkbox } from './Checkbox';

describe('Checkbox', () => {
  it('toggles from its label', async () => {
    const user = userEvent.setup();
    const onChange = jest.fn();
    const ref = createRef<HTMLInputElement>();
    render(
      <Checkbox
        ref={ref}
        label="Email me updates"
        hint="About once a month"
        onChange={(e) => onChange(e.target.checked)}
      />,
    );
    const box = screen.getByRole('checkbox', { name: 'Email me updates' });
    expect(ref.current).toBe(box);
    expect(box).toHaveAccessibleDescription('About once a month');
    await user.click(screen.getByText('Email me updates'));
    expect(onChange).toHaveBeenCalledWith(true);
    expect(box).toBeChecked();
  });

  it('error sets aria-invalid', () => {
    render(<Checkbox label="I agree" error="You must agree" />);
    const box = screen.getByRole('checkbox', { name: 'I agree' });
    expect(box).toHaveAttribute('aria-invalid', 'true');
    expect(box).toHaveAccessibleDescription('Error: You must agree');
  });

  it('aria-invalid without a message (group error shown at the fieldset)', () => {
    render(<Checkbox label="SMS" aria-invalid />);
    expect(screen.getByRole('checkbox', { name: 'SMS' })).toHaveAttribute(
      'aria-invalid',
      'true',
    );
  });
});
