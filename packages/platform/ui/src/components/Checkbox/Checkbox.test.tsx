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
    // Base UI: role="checkbox" is a <span>; `ref` is the hidden native input beside it.
    expect(ref.current).toHaveAttribute('type', 'checkbox');
    expect(box).toHaveAccessibleDescription('About once a month');
    await user.click(screen.getByText('Email me updates'));
    expect(onChange).toHaveBeenCalledWith(true);
    expect(box).toBeChecked();
    expect(ref.current?.checked).toBe(true);
  });

  it('toggles with Space and submits name/value with the form', async () => {
    const user = userEvent.setup();
    const { container } = render(
      <form>
        <Checkbox label="Updates" name="updates" value="yes" />
        <Checkbox label="Locked" name="locked" disabled defaultChecked />
      </form>,
    );
    const form = container.querySelector('form') as HTMLFormElement;
    const box = screen.getByRole('checkbox', { name: 'Updates' });
    expect(new FormData(form).get('updates')).toBeNull();
    box.focus();
    await user.keyboard(' ');
    expect(box).toBeChecked();
    expect(new FormData(form).get('updates')).toBe('yes');
    const locked = screen.getByRole('checkbox', { name: 'Locked' });
    expect(locked).toHaveAttribute('aria-disabled', 'true');
    await user.click(screen.getByText('Locked'));
    expect(locked).toBeChecked();
    expect(document.querySelectorAll('style')).toHaveLength(0);
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
