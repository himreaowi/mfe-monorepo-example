import type { Meta, StoryObj } from '@storybook/react-webpack5';
import { Brand } from './Brand';

const meta = {
  title: 'Shell building blocks/Brand',
  component: Brand,
  args: { children: 'Staff Portal' },
} satisfies Meta<typeof Brand>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

/** Too long for its box: one line, ellipsis on screen, full text for screen readers. */
export const Truncated: Story = {
  args: {
    className: 'sb-narrow',
    children: 'Department of Very Long Names – Online Services Portal',
  },
};
