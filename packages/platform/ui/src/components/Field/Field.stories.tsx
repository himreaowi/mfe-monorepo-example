import type { Meta, StoryObj } from '@storybook/react-webpack5';
import { Field } from './Field';

const meta = {
  title: 'Forms/Field',
  component: Field,
  args: {
    label: 'Colour',
    hint: 'A custom control wired with the ids Field hands out',
    children: (control) => (
      <input {...control} type="color" defaultValue="#0f766e" />
    ),
  },
} satisfies Meta<typeof Field>;

export default meta;
type Story = StoryObj<typeof meta>;

export const CustomControl: Story = {};
