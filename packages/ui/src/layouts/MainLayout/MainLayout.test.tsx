import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { ThemeProvider } from '../../providers/ThemeProvider';
import { MainLayout } from './MainLayout';

describe('MainLayout', () => {
  it('renders brand, theme toggle and the routed page via <Outlet />', () => {
    render(
      <ThemeProvider>
        <MemoryRouter initialEntries={['/']}>
          <Routes>
            <Route element={<MainLayout brand="Portal" />}>
              <Route index element={<p>home page</p>} />
            </Route>
          </Routes>
        </MemoryRouter>
      </ThemeProvider>,
    );
    expect(screen.getByText('Portal')).toBeInTheDocument();
    expect(screen.getByLabelText('Use dark theme')).toBeInTheDocument();
    expect(screen.getByRole('main')).toHaveTextContent('home page');
    expect(screen.queryByTestId('connection-required')).not.toBeInTheDocument();
  });

  it('shows the connection banner when offline', () => {
    render(
      <ThemeProvider>
        <MainLayout online={false}>
          <p>content</p>
        </MainLayout>
      </ThemeProvider>,
    );
    expect(screen.getByTestId('connection-required')).toBeInTheDocument();
    expect(screen.getByRole('main')).toHaveTextContent('content');
  });
});
