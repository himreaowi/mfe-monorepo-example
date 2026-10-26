import { render, screen } from '@testing-library/react';
import { Alert } from './Alert';

describe('Alert', () => {
  it('error and warning are assertive alerts', () => {
    render(
      <Alert variant="error" title="There is a problem">
        Enter a name
      </Alert>,
    );
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('There is a problem');
    expect(alert).toHaveTextContent('Enter a name');
    expect(alert).toHaveClass('alert', 'error');
  });

  it('headingLevel renders the title as a heading', () => {
    render(
      <Alert variant="error" title="There is a problem" headingLevel={2}>
        x
      </Alert>,
    );
    expect(
      screen.getByRole('heading', { level: 2, name: 'There is a problem' }),
    ).toBeInTheDocument();
  });

  it('info and success are polite status messages', () => {
    render(<Alert variant="success">Saved</Alert>);
    expect(screen.getByRole('status')).toHaveTextContent('Saved');
  });

  it('live={false}: no live region; role can be overridden', () => {
    const { rerender } = render(
      <Alert variant="warning" live={false}>
        Read this
      </Alert>,
    );
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    rerender(
      <Alert variant="warning" role="note">
        Read this
      </Alert>,
    );
    expect(screen.getByRole('note')).toBeInTheDocument();
  });
});
