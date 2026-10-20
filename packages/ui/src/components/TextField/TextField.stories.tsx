import type { Meta, StoryObj } from '@storybook/react-webpack5';
import { TextField } from './TextField';

const meta = {
  title: 'Forms/TextField',
  component: TextField,
  args: { label: 'Full name', name: 'name', autoComplete: 'name' },
} satisfies Meta<typeof TextField>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithHint: Story = {
  args: { hint: 'As it appears on your ID card', required: true },
};

export const WithError: Story = {
  args: {
    label: 'Email address',
    type: 'email',
    defaultValue: 'ana@',
    required: true,
    error: 'Enter an email address like name@example.org',
  },
};

export const Disabled: Story = {
  args: { defaultValue: 'Ana Silva', disabled: true },
};
