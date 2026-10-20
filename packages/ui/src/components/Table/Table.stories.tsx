import type { Meta, StoryObj } from '@storybook/react-webpack5';
import { Badge } from '../Badge/Badge';
import { Table, type TableColumn } from './Table';

type Request = {
  id: string;
  who: string;
  type: string;
  days: number;
  status: string;
};

const rows: Request[] = [
  { id: '1', who: 'Ana Silva', type: 'Annual', days: 5, status: 'Approved' },
  { id: '2', who: 'Ben Okafor', type: 'Sick', days: 2, status: 'Pending' },
  { id: '3', who: 'Chen Wei', type: 'Annual', days: 10, status: 'Rejected' },
];

const statusVariant = {
  Approved: 'success',
  Pending: 'warning',
  Rejected: 'danger',
} as const;

const columns: TableColumn<Request>[] = [
  { key: 'who', header: 'Name', sortable: true, rowHeader: true },
  { key: 'type', header: 'Type', sortable: true },
  { key: 'days', header: 'Days', sortable: true, align: 'end' },
  {
    key: 'status',
    header: 'Status',
    cell: (r) => (
      <Badge variant={statusVariant[r.status as keyof typeof statusVariant]}>
        {r.status}
      </Badge>
    ),
  },
];

const meta = {
  title: 'Components/Table',
  component: Table<Request>,
  args: {
    caption: 'Leave requests',
    columns,
    rows,
    getRowKey: (r: Request) => r.id,
  },
} satisfies Meta<typeof Table<Request>>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Sortable: Story = {};

export const SortedByDays: Story = {
  args: { defaultSort: { key: 'days', direction: 'descending' } },
};

export const Empty: Story = {
  args: {
    rows: [],
    emptyMessage: 'No leave requests yet.',
    captionHidden: true,
  },
};
