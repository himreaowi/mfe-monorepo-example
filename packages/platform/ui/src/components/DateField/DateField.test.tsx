import { createRef } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { DateField } from './DateField';

describe('DateField', () => {
  it('is a labelled native date input', () => {
    const ref = createRef<HTMLInputElement>();
    const onChange = jest.fn();
    render(
      <DateField
        ref={ref}
        label="Start date"
        hint="For example 2026-10-21"
        min="2026-01-01"
        onChange={(e) => onChange(e.target.value)}
      />,
    );
    const input = screen.getByLabelText('Start date');
    expect(ref.current).toBe(input);
    expect(input).toHaveAttribute('type', 'date');
    expect(input).toHaveAttribute('min', '2026-01-01');
    expect(input).toHaveAccessibleDescription('For example 2026-10-21');
    fireEvent.change(input, { target: { value: '2026-10-21' } });
    expect(onChange).toHaveBeenCalledWith('2026-10-21');
  });

  it('error sets aria-invalid', () => {
    render(<DateField label="End date" error="End before start" />);
    expect(screen.getByLabelText('End date')).toHaveAttribute(
      'aria-invalid',
      'true',
    );
  });
});
