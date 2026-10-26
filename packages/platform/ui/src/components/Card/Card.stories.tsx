import type { Meta, StoryObj } from '@storybook/react-webpack5';
import { Button } from '../Button/Button';
import { Card } from './Card';

const meta = {
  title: 'Components/Card',
  component: Card,
  args: {
    title: 'Annual leave',
    children: <p className="sb-flush">12 of 25 days left this year.</p>,
  },
} satisfies Meta<typeof Card>;

export default meta;
type Story = StoryObj<typeof meta>;

export const WithTitle: Story = {};

export const WithFooter: Story = {
  args: {
    footer: (
      <>
        <Button size="sm">Request leave</Button>
        <Button size="sm" variant="ghost">
          History
        </Button>
      </>
    ),
  },
};

export const ListOfCards: Story = {
  render: () => (
    <ul className="sb-grid">
      {['Parking permit', 'Business licence', 'Library card'].map((name) => (
        <Card key={name} as="li" title={name} headingLevel={3}>
          <p className="sb-flush">Apply online in about 10 minutes.</p>
        </Card>
      ))}
    </ul>
  ),
};
