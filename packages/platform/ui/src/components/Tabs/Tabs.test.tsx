import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Tabs, type TabItem } from './Tabs';

const tabs: TabItem[] = [
  { id: 'one', label: 'One', content: 'Panel one' },
  { id: 'two', label: 'Two', content: 'Panel two' },
  { id: 'off', label: 'Off', content: 'Panel off', disabled: true },
  { id: 'three', label: 'Three', content: 'Panel three' },
];

const selectedTab = () => screen.getByRole('tab', { selected: true });

describe('Tabs', () => {
  it('wires tablist, tabs and panels', () => {
    render(<Tabs label="Details" tabs={tabs} />);
    expect(
      screen.getByRole('tablist', { name: 'Details' }),
    ).toBeInTheDocument();
    const one = screen.getByRole('tab', { name: 'One' });
    expect(one).toHaveAttribute('aria-selected', 'true');
    expect(one).toHaveAttribute('tabindex', '0');
    expect(screen.getByRole('tab', { name: 'Two' })).toHaveAttribute(
      'tabindex',
      '-1',
    );
    const panel = screen.getByRole('tabpanel', { name: 'One' });
    expect(panel).toHaveTextContent('Panel one');
    expect(one).toHaveAttribute('aria-controls', panel.id);
    expect(screen.getByText('Panel two')).not.toBeVisible();
  });

  it('automatic: arrows, Home and End move and select, skipping disabled tabs', async () => {
    const user = userEvent.setup();
    const onSelect = jest.fn();
    render(<Tabs label="Details" tabs={tabs} onSelect={onSelect} />);
    await user.tab();
    expect(screen.getByRole('tab', { name: 'One' })).toHaveFocus();
    await user.keyboard('{ArrowRight}');
    expect(selectedTab()).toHaveAccessibleName('Two');
    await user.keyboard('{ArrowRight}');
    expect(selectedTab()).toHaveAccessibleName('Three');
    expect(selectedTab()).toHaveFocus();
    await user.keyboard('{ArrowRight}');
    expect(selectedTab()).toHaveAccessibleName('One');
    await user.keyboard('{End}');
    expect(selectedTab()).toHaveAccessibleName('Three');
    await user.keyboard('{Home}');
    expect(selectedTab()).toHaveAccessibleName('One');
    await user.keyboard('{ArrowLeft}');
    expect(onSelect).toHaveBeenLastCalledWith('three');
    // Tab leaves the list to the panel
    await user.tab();
    expect(screen.getByRole('tabpanel')).toHaveFocus();
  });

  it('manual: arrows move focus only; Enter selects', async () => {
    const user = userEvent.setup();
    render(<Tabs label="Details" tabs={tabs} activation="manual" />);
    await user.tab();
    await user.keyboard('{ArrowRight}');
    expect(screen.getByRole('tab', { name: 'Two' })).toHaveFocus();
    expect(selectedTab()).toHaveAccessibleName('One');
    await user.keyboard('{Enter}');
    expect(selectedTab()).toHaveAccessibleName('Two');
  });

  it('controlled: follows selectedId', async () => {
    const user = userEvent.setup();
    const onSelect = jest.fn();
    render(
      <Tabs label="Details" tabs={tabs} selectedId="two" onSelect={onSelect} />,
    );
    expect(selectedTab()).toHaveAccessibleName('Two');
    await user.click(screen.getByRole('tab', { name: 'Three' }));
    expect(onSelect).toHaveBeenCalledWith('three');
    expect(selectedTab()).toHaveAccessibleName('Two');
  });
});
