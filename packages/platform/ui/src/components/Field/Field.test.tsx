import { render, screen } from '@testing-library/react';
import { Field } from './Field';

describe('Field', () => {
  it('labels the control and links hint and error', () => {
    render(
      <Field label="Code" hint="Six digits" error="Enter the code" required>
        {(control) => <input {...control} />}
      </Field>,
    );
    const input = screen.getByRole('textbox', { name: 'Code (required)' });
    expect(input).toBeRequired();
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAccessibleDescription(
      'Six digits Error: Enter the code',
    );
  });

  it('no hint, no error: no aria-describedby, no aria-invalid; custom id kept', () => {
    render(
      <Field label="Name" id="name" describedBy="extra">
        {(control) => <input {...control} />}
      </Field>,
    );
    const input = screen.getByRole('textbox', { name: 'Name' });
    expect(input).toHaveAttribute('id', 'name');
    expect(input).toHaveAttribute('aria-describedby', 'extra');
    expect(input).not.toHaveAttribute('aria-invalid');
    expect(input).not.toBeRequired();
  });
});
