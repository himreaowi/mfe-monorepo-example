import type { Meta, StoryObj } from '@storybook/react-webpack5';
import { Checkbox } from './Checkbox';

const meta = {
  title: 'Forms/Checkbox',
  component: Checkbox,
  args: { label: 'Email me when my request is answered' },
} satisfies Meta<typeof Checkbox>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const CheckedWithHint: Story = {
  args: { defaultChecked: true, hint: 'At most one email a day' },
};

export const WithError: Story = {
  args: {
    label: 'I confirm the details are correct',
    error: 'Confirm the details',
  },
};

/** Related checkboxes: a fieldset + legend around them. */
export const Group: Story = {
  render: () => (
    <fieldset className="sb-fieldset">
      <legend>Notify me about</legend>
      <Checkbox label="New announcements" defaultChecked />
      <Checkbox label="Payment reminders" />
      <Checkbox label="Service outages" disabled />
    </fieldset>
  ),
};
