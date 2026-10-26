import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { render, screen } from '@testing-library/react';
import { Link, MemoryRouter } from 'react-router';
import { Brand } from './Brand';

const LONG_BRAND = 'Citizen Services Portal of the Example Region';

describe('Brand', () => {
  it('truncates on screen only: one line, ellipsis, can shrink', () => {
    const source = readFileSync(join(__dirname, 'Brand.module.scss'), 'utf8');
    expect(source).toMatch(/white-space: nowrap;/);
    expect(source).toMatch(/overflow: hidden;/);
    expect(source).toMatch(/text-overflow: ellipsis;/);
    expect(source).toMatch(/min-width: 0;/);
    expect(source).not.toMatch(/overflow-wrap/);
  });

  it('keeps the full text in the DOM and the accessibility tree, once, without a tooltip', () => {
    render(
      <header>
        <Brand data-testid="brand" className="extra">
          {LONG_BRAND}
        </Brand>
      </header>,
    );
    const brand = screen.getByTestId('brand');
    expect(brand).toHaveClass('brand');
    expect(brand).toHaveClass('extra');
    expect(brand).toHaveTextContent(LONG_BRAND, { normalizeWhitespace: true });
    expect(brand).not.toHaveAttribute('title');
    expect(brand).not.toHaveAttribute('aria-label');
    // no visually hidden duplicate: the banner holds the name exactly once
    expect(
      screen.getByRole('banner').textContent?.split(LONG_BRAND),
    ).toHaveLength(2);
    expect(screen.getAllByText(LONG_BRAND)).toHaveLength(1);
  });

  it('a brand link keeps the full accessible name', () => {
    render(
      <MemoryRouter>
        <Brand data-testid="brand">
          <Link to="/">{LONG_BRAND}</Link>
        </Brand>
      </MemoryRouter>,
    );
    const link = screen.getByRole('link', { name: LONG_BRAND });
    expect(screen.getByTestId('brand')).toContainElement(link);
    expect(link).not.toHaveAttribute('title');
    expect(link).toHaveAccessibleName(LONG_BRAND);
    expect(link).not.toHaveAccessibleDescription();
  });
});
