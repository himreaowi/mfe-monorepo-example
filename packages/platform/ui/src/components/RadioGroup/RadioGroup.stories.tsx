import type { Meta, StoryObj } from '@storybook/react-webpack5';
import { RadioGroup } from './RadioGroup';

const meta = {
  title: 'Forms/RadioGroup',
  component: RadioGroup,
  args: {
    label: 'How should we contact you?',
    defaultValue: 'email',
    options: [
      { value: 'email', label: 'Email' },
      { value: 'phone', label: 'Phone', hint: 'Weekdays 9:00–17:00' },
      { value: 'post', label: 'Post', disabled: true },
    ],
  },
} satisfies Meta<typeof RadioGroup>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const InlineWithError: Story = {
  args: {
    label: 'Half day?',
    defaultValue: undefined,
    inline: true,
    required: true,
    error: 'Choose yes or no',
    options: [
      { value: 'yes', label: 'Yes' },
      { value: 'no', label: 'No' },
    ],
  },
};
