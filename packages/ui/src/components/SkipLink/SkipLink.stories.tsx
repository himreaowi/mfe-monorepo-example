import type { Meta, StoryObj } from '@storybook/react-webpack5';
import { SkipLink } from './SkipLink';

const meta = {
  title: 'Shell building blocks/SkipLink',
  component: SkipLink,
  args: { targetId: 'story-main' },
  render: (args) => (
    <>
      <SkipLink {...args} />
      <p>Press Tab to show the skip link (hidden until focused).</p>
      <main id="story-main" tabIndex={-1}>
        Main content
      </main>
    </>
  ),
} satisfies Meta<typeof SkipLink>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
