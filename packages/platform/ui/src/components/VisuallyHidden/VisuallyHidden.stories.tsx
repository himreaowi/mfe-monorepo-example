import type { Meta, StoryObj } from '@storybook/react-webpack5';
import { VisuallyHidden } from './VisuallyHidden';

const meta = {
  title: 'Components/VisuallyHidden',
  component: VisuallyHidden,
} satisfies Meta<typeof VisuallyHidden>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The hidden text is read by screen readers only ("Error: Enter a name"). */
export const InText: Story = {
  render: () => (
    <p>
      <VisuallyHidden>Error: </VisuallyHidden>Enter a name
    </p>
  ),
};
