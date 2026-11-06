import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Dialog } from './Dialog';

// jsdom has <dialog> but not showModal()/close(): minimal stand-ins with the native events.
beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function showModal(
    this: HTMLDialogElement,
  ) {
    this.setAttribute('open', '');
  };
  HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) {
    if (!this.open) return;
    this.removeAttribute('open');
    this.dispatchEvent(new Event('close'));
  };
});

function Example({ onClose = () => {} }: { onClose?: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Delete request
      </button>
      <Dialog
        open={open}
        onClose={() => {
          onClose();
          setOpen(false);
        }}
        title="Delete this request?"
        description="This cannot be undone."
        footer={
          <button type="button" onClick={() => setOpen(false)}>
            Cancel
          </button>
        }
      >
        <p>Body text</p>
      </Dialog>
    </>
  );
}

describe('Dialog', () => {
  it('opens as a labelled, described modal and closes with the × button', async () => {
    const user = userEvent.setup();
    const onClose = jest.fn();
    render(<Example onClose={onClose} />);
    const opener = screen.getByRole('button', { name: 'Delete request' });
    await user.click(opener);
    const dialog = screen.getByRole('dialog', { name: 'Delete this request?' });
    expect(dialog).toHaveAttribute('open');
    expect(dialog).toHaveAccessibleDescription('This cannot be undone.');
    expect(screen.getByText('Body text')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(dialog).not.toHaveAttribute('open');
    expect(opener).toHaveFocus();
  });

  it('closing from outside (open=false) closes the element and returns focus', async () => {
    const user = userEvent.setup();
    render(<Example />);
    const opener = screen.getByRole('button', { name: 'Delete request' });
    await user.click(opener);
    await user.click(
      screen.getByRole('button', { name: 'Cancel', hidden: true }),
    );
    expect(screen.getByRole('dialog', { hidden: true })).not.toHaveAttribute(
      'open',
    );
    expect(opener).toHaveFocus();
  });

  it('Escape (the native cancel → close events) calls onClose', async () => {
    const user = userEvent.setup();
    const onClose = jest.fn();
    render(<Example onClose={onClose} />);
    await user.click(screen.getByRole('button', { name: 'Delete request' }));
    // the browser closes a modal dialog on Escape and fires "close"
    screen.getByRole<HTMLDialogElement>('dialog').close();
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
