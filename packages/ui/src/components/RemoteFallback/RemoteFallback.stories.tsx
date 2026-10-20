import type { Meta, StoryObj } from '@storybook/react-webpack5';
import { RemoteFallback } from './RemoteFallback';

const meta = {
  title: 'Shell building blocks/RemoteFallback',
  component: RemoteFallback,
} satisfies Meta<typeof RemoteFallback>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithRetry: Story = { args: { onRetry: () => {} } };
