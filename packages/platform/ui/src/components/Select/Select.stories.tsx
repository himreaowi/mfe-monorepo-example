import type { Meta, StoryObj } from '@storybook/react-webpack5';
import { Select } from './Select';

const meta = {
  title: 'Forms/Select',
  component: Select,
  args: {
    label: 'Leave type',
    placeholder: 'Choose a type',
    options: [
      { value: 'annual', label: 'Annual leave' },
      { value: 'sick', label: 'Sick leave' },
      { value: 'unpaid', label: 'Unpaid leave', disabled: true },
    ],
  },
} satisfies Meta<typeof Select>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithError: Story = {
  args: {
    required: true,
    error: 'Choose a leave type',
    hint: 'Sick leave needs a note',
  },
};
