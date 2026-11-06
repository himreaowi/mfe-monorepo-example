import type { Meta, StoryObj } from '@storybook/react-webpack5';
import { TextArea } from './TextArea';

const meta = {
  title: 'Forms/TextArea',
  component: TextArea,
  args: {
    label: 'Reason',
    hint: 'Optional. Up to 500 characters.',
    name: 'reason',
  },
} satisfies Meta<typeof TextArea>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithError: Story = {
  args: { required: true, error: 'Enter a reason', hint: undefined },
};
