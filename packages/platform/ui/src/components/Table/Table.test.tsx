import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Table, type TableColumn } from './Table';

type Person = { id: string; name: string; days: number };
const rows: Person[] = [
  { id: 'a', name: 'Bea', days: 3 },
  { id: 'b', name: 'Ana', days: 12 },
  { id: 'c', name: 'Cy', days: 7 },
];
const columns: TableColumn<Person>[] = [
  { key: 'name', header: 'Name', sortable: true, rowHeader: true },
  {
    key: 'days',
    header: 'Days',
    sortable: true,
    align: 'end',
    cell: (p) => `${p.days} d`,
  },
];

const firstColumn = () =>
  screen.getAllByRole('rowheader').map((cell) => cell.textContent);

describe('Table', () => {
  it('renders a captioned table with column and row headers', () => {
    render(
      <Table
        caption="Leave"
        columns={columns}
        rows={rows}
        getRowKey={(r) => r.id}
      />,
    );
    const table = screen.getByRole('table', { name: 'Leave' });
    expect(within(table).getAllByRole('columnheader')).toHaveLength(2);
    expect(firstColumn()).toEqual(['Bea', 'Ana', 'Cy']);
    expect(screen.getByText('12 d')).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Leave' })).toHaveAttribute(
      'tabindex',
      '0',
    );
  });

  it('sorts with header buttons and sets aria-sort', async () => {
    const user = userEvent.setup();
    const onSortChange = jest.fn();
    render(
      <Table
        caption="Leave"
        columns={columns}
        rows={rows}
        getRowKey={(r) => r.id}
        onSortChange={onSortChange}
      />,
    );
    const nameHeader = screen.getByRole('columnheader', { name: /Name/ });
    expect(nameHeader).toHaveAttribute('aria-sort', 'none');
    await user.click(screen.getByRole('button', { name: /Name/ }));
    expect(nameHeader).toHaveAttribute('aria-sort', 'ascending');
    expect(firstColumn()).toEqual(['Ana', 'Bea', 'Cy']);
    expect(screen.getByRole('status')).toHaveTextContent(
      'Sorted by Name, ascending',
    );
    await user.click(screen.getByRole('button', { name: /Name/ }));
    expect(nameHeader).toHaveAttribute('aria-sort', 'descending');
    expect(firstColumn()).toEqual(['Cy', 'Bea', 'Ana']);
    await user.click(screen.getByRole('button', { name: /Days/ }));
    expect(firstColumn()).toEqual(['Bea', 'Cy', 'Ana']);
    expect(onSortChange).toHaveBeenLastCalledWith({
      key: 'days',
      direction: 'ascending',
    });
  });

  it('controlled sort and the empty message', () => {
    const { rerender } = render(
      <Table
        caption="Leave"
        captionHidden
        columns={columns}
        rows={rows}
        getRowKey={(r) => r.id}
        sort={{ key: 'days', direction: 'descending' }}
      />,
    );
    expect(firstColumn()).toEqual(['Ana', 'Cy', 'Bea']);
    rerender(
      <Table
        caption="Leave"
        columns={columns}
        rows={[]}
        getRowKey={(r) => r.id}
      />,
    );
    expect(screen.getByText('No data.')).toBeInTheDocument();
  });
});
