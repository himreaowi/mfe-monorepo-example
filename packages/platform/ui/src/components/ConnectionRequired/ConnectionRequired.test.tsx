import { render, screen } from '@testing-library/react';
import { ConnectionRequired } from './ConnectionRequired';

describe('ConnectionRequired', () => {
  it('conveys internet connection required', () => {
    render(<ConnectionRequired />);
    expect(screen.getByTestId('connection-required')).toHaveTextContent(
      /internet connection required/i,
    );
  });
});
