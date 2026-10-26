import type { Meta, StoryObj } from '@storybook/react-webpack5';
import { DateField } from './DateField';

const meta = {
  title: 'Forms/DateField',
  component: DateField,
  args: { label: 'Start date', defaultValue: '2026-10-21' },
} satisfies Meta<typeof DateField>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithError: Story = {
  args: {
    label: 'End date',
    required: true,
    min: '2026-10-21',
    defaultValue: '2026-10-20',
    hint: 'On or after the start date',
    error: 'The end date must be on or after the start date',
  },
};
