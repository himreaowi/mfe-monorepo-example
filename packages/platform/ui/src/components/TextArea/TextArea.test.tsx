import { createRef } from 'react';
import { render, screen } from '@testing-library/react';
import { TextArea } from './TextArea';

describe('TextArea', () => {
  it('is a labelled multi-line input', () => {
    const ref = createRef<HTMLTextAreaElement>();
    render(
      <TextArea
        ref={ref}
        label="Reason"
        hint="Optional"
        error="Too long"
        defaultValue="x"
      />,
    );
    const textArea = screen.getByRole('textbox', { name: 'Reason' });
    expect(ref.current).toBe(textArea);
    expect(textArea.tagName).toBe('TEXTAREA');
    expect(textArea).toHaveAttribute('rows', '4');
    expect(textArea).toHaveAttribute('aria-invalid', 'true');
    expect(textArea).toHaveAccessibleDescription('Optional Error: Too long');
  });
});
