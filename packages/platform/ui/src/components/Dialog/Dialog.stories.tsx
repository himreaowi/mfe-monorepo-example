import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-webpack5';
import { Button } from '../Button/Button';
import { Dialog, type DialogProps } from './Dialog';

function DialogDemo(
  props: Omit<DialogProps, 'open' | 'onClose'> & { initiallyOpen?: boolean },
) {
  const { initiallyOpen = false, ...rest } = props;
  const [open, setOpen] = useState(initiallyOpen);
  return (
    <>
      <Button variant="danger" onClick={() => setOpen(true)}>
        Withdraw request
      </Button>
      <Dialog
        {...rest}
        open={open}
        onClose={() => setOpen(false)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={() => setOpen(false)}>
              Withdraw
            </Button>
          </>
        }
      />
    </>
  );
}

const meta = {
  title: 'Components/Dialog',
  component: DialogDemo,
  args: {
    title: 'Withdraw this request?',
    description: 'Your manager will be told. You can send a new request later.',
  },
} satisfies Meta<typeof DialogDemo>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Closed: press the button (focus returns to it when the dialog closes). */
export const Closed: Story = {};

export const Open: Story = { args: { initiallyOpen: true } };

export const OpenSmallWithBody: Story = {
  args: {
    initiallyOpen: true,
    size: 'sm',
    description: undefined,
    children: <p>Annual leave, 3–7 November 2026 (5 days).</p>,
  },
};
