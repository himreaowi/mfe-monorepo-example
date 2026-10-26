import type { Meta, StoryObj } from '@storybook/react-webpack5';
import { Tabs } from './Tabs';

const meta = {
  title: 'Components/Tabs',
  component: Tabs,
  args: {
    label: 'Request',
    tabs: [
      {
        id: 'details',
        label: 'Details',
        content: <p className="sb-flush">5 days of annual leave.</p>,
      },
      {
        id: 'history',
        label: 'History',
        content: <p className="sb-flush">Sent on 1 October.</p>,
      },
      {
        id: 'files',
        label: 'Files',
        content: <p className="sb-flush">No files.</p>,
        disabled: true,
      },
      {
        id: 'notes',
        label: 'Notes',
        content: <p className="sb-flush">No notes yet.</p>,
      },
    ],
  },
} satisfies Meta<typeof Tabs>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Arrow keys move focus and show the tab. */
export const Automatic: Story = {};

/** Arrow keys only move focus; Enter or Space shows the tab (for panels that load data). */
export const Manual: Story = {
  args: { activation: 'manual', defaultSelectedId: 'history' },
};
