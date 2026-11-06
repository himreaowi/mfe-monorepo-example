import { createRef } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TextField } from './TextField';

describe('TextField', () => {
  it('is a labelled input that reports changes', async () => {
    const user = userEvent.setup();
    const onChange = jest.fn();
    const ref = createRef<HTMLInputElement>();
    render(
      <TextField
        ref={ref}
        label="Name"
        hint="As on your ID"
        name="name"
        className="wrap"
        onChange={(e) => onChange(e.target.value)}
      />,
    );
    const input = screen.getByRole('textbox', { name: 'Name' });
    expect(ref.current).toBe(input);
    expect(input).toHaveAttribute('type', 'text');
    expect(input).toHaveAttribute('name', 'name');
    expect(input).toHaveAccessibleDescription('As on your ID');
    expect(input.closest('.wrap')).not.toBeNull();
    await user.type(input, 'Ana');
    expect(onChange).toHaveBeenLastCalledWith('Ana');
  });

  it('error: aria-invalid and the message in the description', () => {
    render(
      <TextField
        label="Email"
        type="email"
        required
        error="Enter an email address"
        aria-describedby="other"
      />,
    );
    const input = screen.getByRole('textbox', { name: 'Email (required)' });
    expect(input).toHaveAttribute('type', 'email');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input.getAttribute('aria-describedby')).toMatch(/-error other$/);
    expect(input).toBeRequired();
  });
});
