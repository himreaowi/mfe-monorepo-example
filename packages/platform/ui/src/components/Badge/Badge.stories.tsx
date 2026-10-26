import type { Meta, StoryObj } from '@storybook/react-webpack5';
import { Badge } from './Badge';

const meta = {
  title: 'Components/Badge',
  component: Badge,
  args: { children: 'Draft' },
} satisfies Meta<typeof Badge>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Neutral: Story = {};

export const Variants: Story = {
  render: () => (
    <div className="sb-row">
      <Badge>Draft</Badge>
      <Badge variant="accent">New</Badge>
      <Badge variant="info">Submitted</Badge>
      <Badge variant="success">Approved</Badge>
      <Badge variant="warning">Pending</Badge>
      <Badge variant="danger">Rejected</Badge>
    </div>
  ),
};
