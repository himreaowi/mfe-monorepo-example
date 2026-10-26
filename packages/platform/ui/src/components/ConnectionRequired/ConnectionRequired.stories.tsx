import type { Meta, StoryObj } from '@storybook/react-webpack5';
import { ConnectionRequired } from './ConnectionRequired';

const meta = {
  title: 'Shell building blocks/ConnectionRequired',
  component: ConnectionRequired,
} satisfies Meta<typeof ConnectionRequired>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
