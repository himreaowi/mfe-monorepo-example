import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Combobox, type ComboboxProps } from './Combobox';

type Fruit = { id: string; name: string };
const fruits: Fruit[] = [
  { id: 'a', name: 'Apple' },
  { id: 'b', name: 'Banana' },
  { id: 'c', name: 'Cherry' },
];

function Demo(
  props: Partial<ComboboxProps<Fruit>> & {
    onPick?: (v: Fruit | null) => void;
  },
) {
  const { onPick, ...rest } = props;
  const [value, setValue] = useState<Fruit | null>(null);
  const [text, setText] = useState('');
  const items = fruits.filter((f) =>
    f.name.toLowerCase().includes(text.toLowerCase()),
  );
  return (
    <Combobox<Fruit>
      label="Fruit"
      items={text ? items : []}
      value={value}
      onValueChange={(v) => {
        setValue(v);
        onPick?.(v);
      }}
      onInputValueChange={setText}
      itemToString={(f) => f.name}
      itemToKey={(f) => f.id}
      {...rest}
    />
  );
}

describe('Combobox', () => {
  it('chooses an option with the arrow keys and Enter', async () => {
    const user = userEvent.setup();
    const onPick = jest.fn();
    render(<Demo onPick={onPick} />);
    const input = screen.getByRole('combobox', { name: 'Fruit' });
    await user.type(input, 'an');
    expect(await screen.findByRole('option', { name: 'Banana' })).toBeVisible();
    expect(screen.getAllByRole('option')).toHaveLength(1);
    expect(screen.getByText('1 result')).toBeInTheDocument(); // live region
    await user.keyboard('{ArrowDown}{Enter}');
    expect(onPick).toHaveBeenCalledWith({ id: 'b', name: 'Banana' });
    expect(input).toHaveValue('Banana');
  });

  it('passes each typed text to onInputValueChange', async () => {
    const user = userEvent.setup();
    const onInput = jest.fn();
    render(
      <Combobox<Fruit>
        label="Fruit"
        items={[]}
        value={null}
        onValueChange={() => {}}
        onInputValueChange={onInput}
        itemToString={(f) => f.name}
      />,
    );
    await user.type(screen.getByRole('combobox', { name: 'Fruit' }), 'ch');
    expect(onInput.mock.calls.map((c) => c[0])).toEqual(['c', 'ch']);
  });

  it('closes the list with Escape', async () => {
    const user = userEvent.setup();
    render(<Demo />);
    await user.type(screen.getByRole('combobox', { name: 'Fruit' }), 'a');
    expect(await screen.findAllByRole('option')).not.toHaveLength(0);
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('option')).toBeNull();
  });

  it('shows the loading and empty texts', async () => {
    const user = userEvent.setup();
    const { rerender } = render(
      <Demo loading loadingText="Looking…" emptyText="Nothing found." />,
    );
    await user.type(screen.getByRole('combobox', { name: 'Fruit' }), 'zz');
    expect(await screen.findByText('Looking…')).toBeInTheDocument();
    expect(screen.queryByText('Nothing found.')).toBeNull();
    rerender(<Demo emptyText="Nothing found." />);
    expect(await screen.findByText('Nothing found.')).toBeInTheDocument();
    expect(screen.queryByText('Looking…')).toBeNull();
  });

  it('wires the label, hint and error to the input', () => {
    render(<Demo hint="Type a name" error="Choose a fruit" required />);
    const input = screen.getByRole('combobox', { name: 'Fruit (required)' });
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAccessibleDescription(
      'Type a name Error: Choose a fruit',
    );
  });

  it('shows the chosen value and clears it', async () => {
    const user = userEvent.setup();
    const onValueChange = jest.fn();
    render(
      <Combobox<Fruit>
        label="Fruit"
        items={[]}
        value={fruits[2]}
        onValueChange={onValueChange}
        itemToString={(f) => f.name}
        clearLabel="Clear fruit"
      />,
    );
    expect(screen.getByRole('combobox', { name: 'Fruit' })).toHaveValue(
      'Cherry',
    );
    await user.click(screen.getByRole('button', { name: 'Clear fruit' }));
    expect(onValueChange).toHaveBeenCalledWith(null);
  });

  it('stays non-modal while the list is open: nothing is aria-hidden, the label stays', async () => {
    const user = userEvent.setup();
    render(
      <>
        <a href="#main">Skip to content</a>
        <label htmlFor="other">Other field</label>
        <input id="other" />
        <Demo />
      </>,
    );
    const input = screen.getByRole('combobox', { name: 'Fruit' });
    await user.type(input, 'a');
    expect(await screen.findAllByRole('option')).not.toHaveLength(0);
    expect(input).toHaveAttribute('aria-expanded', 'true');
    expect(
      document.querySelectorAll('[aria-hidden="true"]:not([aria-hidden] *)'),
    ).toHaveLength(
      // only the decorative × inside the clear button
      1,
    );
    expect(
      document.querySelector('[aria-hidden="true"]')?.closest('button'),
    ).toHaveAccessibleName('Clear');
    expect(document.querySelectorAll('[inert]')).toHaveLength(0);
    expect(screen.getByRole('link', { name: 'Skip to content' })).toBeVisible();
    expect(
      screen.getByRole('textbox', { name: 'Other field' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Fruit').closest('[aria-hidden]')).toBeNull();
    expect(input).toHaveAccessibleName('Fruit');
    expect(screen.getByRole('listbox', { name: 'Fruit' })).toBeVisible();
  });
});
