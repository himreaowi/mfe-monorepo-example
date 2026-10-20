import type { Meta, StoryObj } from '@storybook/react-webpack5';
import { Alert } from './Alert';

const meta = {
  title: 'Components/Alert',
  component: Alert,
  args: {
    title: 'Request sent',
    children: 'Your manager will reply within 2 days.',
  },
} satisfies Meta<typeof Alert>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Info: Story = {
  args: { variant: 'info', title: 'Office closed on Friday' },
};

export const Variants: Story = {
  render: () => (
    <div className="sb-stack">
      <Alert variant="info" title="Information" live={false}>
        The office is closed on Friday.
      </Alert>
      <Alert variant="success" title="Saved" live={false}>
        Your changes were saved.
      </Alert>
      <Alert variant="warning" title="Check your dates" live={false}>
        The request overlaps a public holiday.
      </Alert>
      <Alert variant="error" title="There is a problem" live={false}>
        The request could not be sent. Try again.
      </Alert>
    </div>
  ),
};

export const WithoutTitle: Story = {
  args: {
    variant: 'error',
    title: undefined,
    children: 'Could not load the list.',
  },
};
