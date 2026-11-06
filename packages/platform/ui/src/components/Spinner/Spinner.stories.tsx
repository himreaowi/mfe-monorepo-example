import type { Meta, StoryObj } from '@storybook/react-webpack5';
import { Spinner } from './Spinner';

const meta = {
  title: 'Components/Spinner',
  component: Spinner,
} satisfies Meta<typeof Spinner>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const VisibleLabel: Story = {
  args: { label: 'Loading requests…', labelVisible: true },
};

export const Sizes: Story = {
  render: () => (
    <div className="sb-row">
      <Spinner size="sm" label="Small" labelVisible />
      <Spinner size="md" label="Medium" labelVisible />
      <Spinner size="lg" label="Large" labelVisible />
    </div>
  ),
};
