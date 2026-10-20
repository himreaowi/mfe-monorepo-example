import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { CreateItemResult } from '../../hooks/useCreateItem';
import type { ItemDraft } from '../../types/item';
import { AddItemForm } from './AddItemForm';

// A form that only displays and validates: sending is the page's `onCreate` (useCreateItem).
function renderForm(
  onCreate: (draft: ItemDraft) => Promise<CreateItemResult> = jest.fn(),
) {
  const onCreated = jest.fn();
  render(<AddItemForm onCreate={onCreate} onCreated={onCreated} />);
  return { onCreate, onCreated, user: userEvent.setup() };
}

describe('AddItemForm', () => {
  it('validates on submit: error summary (focused) + field error, nothing sent', async () => {
    const { user, onCreate } = renderForm();
    const submit = screen.getByRole('button', { name: 'Add item' });
    expect(submit).toBeEnabled(); // never disabled because the form is invalid
    await user.click(submit);
    const summary = screen.getByTestId('error-summary');
    expect(summary).toHaveFocus();
    expect(summary).toHaveTextContent('There is a problem');
    const input = screen.getByLabelText('Name');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAccessibleDescription('Error: Enter a name.');
    expect(onCreate).not.toHaveBeenCalled();
    await user.click(screen.getByRole('link', { name: 'Enter a name.' }));
    expect(input).toHaveFocus();
  });

  it('disables submit only while sending, then reports success', async () => {
    let resolve: (value: CreateItemResult) => void = () => undefined;
    const onCreate = jest.fn(
      () => new Promise<CreateItemResult>((r) => (resolve = r)),
    );
    const { user, onCreated } = renderForm(onCreate);
    await user.type(screen.getByLabelText('Name'), 'New item');
    await user.click(screen.getByRole('button', { name: 'Add item' }));
    expect(onCreate).toHaveBeenCalledWith({ name: 'New item' });
    expect(screen.getByRole('button', { name: 'Adding…' })).toBeDisabled();
    resolve({ ok: true, item: { id: 9, name: 'New item', description: '' } });
    expect(await screen.findByText('Added “New item”.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add item' })).toBeEnabled();
    expect(onCreated).toHaveBeenCalledWith(expect.objectContaining({ id: 9 }));
    expect(screen.getByLabelText('Name')).toHaveValue('');
  });

  it('shows server 422 field errors in the same summary and field', async () => {
    const { user } = renderForm(
      jest.fn().mockResolvedValue({
        ok: false,
        fieldErrors: { name: 'An item with this name already exists.' },
        message: 'Please correct the highlighted field.',
      }),
    );
    await user.type(screen.getByLabelText('Name'), 'Getting started');
    await user.click(screen.getByRole('button', { name: 'Add item' }));
    expect(await screen.findByTestId('error-summary')).toHaveTextContent(
      'An item with this name already exists.',
    );
    expect(screen.getByLabelText('Name')).toHaveAttribute(
      'aria-invalid',
      'true',
    );
  });

  it('shows other failures as a form error', async () => {
    const { user } = renderForm(
      jest.fn().mockResolvedValue({
        ok: false,
        message: 'Could not add the item. Check your connection and try again.',
      }),
    );
    await user.type(screen.getByLabelText('Name'), 'x');
    await user.click(screen.getByRole('button', { name: 'Add item' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      /Could not add the item/,
    );
  });
});
