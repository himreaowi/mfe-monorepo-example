import type { Meta, StoryObj } from '@storybook/react-webpack5';
import { MemoryRouter } from 'react-router';
import { Link } from './Link';

const meta: Meta = {
  title: 'Components/Link',
  component: Link,
  decorators: [
    (Story) => (
      <MemoryRouter>
        <Story />
      </MemoryRouter>
    ),
  ],
};

export default meta;
type Story = StoryObj;

/** `to`: react-router link (client-side navigation). */
export const RouterLink: Story = {
  render: () => <Link to="/details">View details</Link>,
};

/** `href`: plain link; `newTab` adds target, rel and screen-reader text. */
export const PlainAndNewTab: Story = {
  render: () => (
    <p>
      <Link href="mailto:help@example.org">Email the help desk</Link> or read{' '}
      <Link href="https://www.w3.org/WAI/" newTab>
        the WAI guidance
      </Link>
      .
    </p>
  ),
};
