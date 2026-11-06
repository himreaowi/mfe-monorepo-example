import type { Meta, StoryObj } from '@storybook/react-webpack5';
import { ThemeProvider } from '../../providers/ThemeProvider/ThemeProvider';
import { ThemeToggle } from './ThemeToggle';

const meta: Meta<typeof ThemeToggle> = {
  title: 'Shell building blocks/ThemeToggle',
  component: ThemeToggle,
  // follower: shows the toolbar's theme (data-theme on <html>); the shell's root provider
  // would own and change it.
  decorators: [
    (Story) => (
      <ThemeProvider mode="follower">
        <Story />
      </ThemeProvider>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
