import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-webpack5';
import { Combobox, type ComboboxProps } from './Combobox';

type Colleague = { id: string; name: string; role: string };

const people: Colleague[] = [
  { id: '1', name: 'Ada Lovelace', role: 'Analyst' },
  { id: '2', name: 'Grace Hopper', role: 'Engineer' },
  { id: '3', name: 'Alan Turing', role: 'Researcher' },
  { id: '4', name: 'Katherine Johnson', role: 'Mathematician' },
];

type DemoProps = Omit<
  ComboboxProps<Colleague>,
  'items' | 'value' | 'onValueChange' | 'itemToString'
> & { initialValue?: Colleague | null };

/** Searches a fixed list as you type (an app passes the results of its query hook). */
function ComboboxDemo({ initialValue = null, ...rest }: DemoProps) {
  const [value, setValue] = useState(initialValue);
  const [text, setText] = useState('');
  const q = text.trim().toLowerCase();
  const items = q ? people.filter((p) => p.name.toLowerCase().includes(q)) : [];
  return (
    <Combobox<Colleague>
      {...rest}
      items={items}
      value={value}
      onValueChange={setValue}
      onInputValueChange={setText}
      itemToString={(p) => p.name}
      itemToKey={(p) => p.id}
      renderItem={(p) => (
        <>
          {p.name}
          <br />
          <small>{p.role}</small>
        </>
      )}
    />
  );
}

const meta = {
  title: 'Forms/Combobox',
  component: ComboboxDemo,
  args: {
    label: 'Colleague',
    hint: 'Type a name, e.g. "a"',
    placeholder: 'Search by name',
  },
} satisfies Meta<typeof ComboboxDemo>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Type to search: arrows move, Enter chooses, Escape closes the list. */
export const Default: Story = {};

export const WithValue: Story = {
  args: { initialValue: people[1], clearLabel: 'Clear colleague' },
};

export const WithError: Story = {
  args: { required: true, error: 'Choose a colleague' },
};
