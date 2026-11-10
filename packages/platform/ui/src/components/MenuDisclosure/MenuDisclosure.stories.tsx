import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-webpack5';
import { MenuDisclosure } from './MenuDisclosure';
import styles from './MenuDisclosure.module.scss';

/** A phone header: brand, "Menu" button and the panel it shows (links + a Sign out button). */
function Header({ defaultOpen = false }: { defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{ minHeight: '14rem' }}>
      <MenuDisclosure.Root
        open={open}
        onOpenChange={setOpen}
        render={<header className={styles.header} />}
      >
        <strong>Portal</strong>
        <MenuDisclosure.Button className={styles.button}>
          Menu
        </MenuDisclosure.Button>
        <MenuDisclosure.Panel
          className={open ? `${styles.panel} ${styles.open}` : styles.panel}
        >
          <nav aria-label="Main">
            <a href="#home">Home</a>
          </nav>
          <a href="#leave">Leave requests</a>
          <button type="button" className={styles.button} data-menu-close>
            Sign out
          </button>
        </MenuDisclosure.Panel>
      </MenuDisclosure.Root>
    </div>
  );
}

const meta = {
  title: 'Components/MenuDisclosure',
  component: Header,
} satisfies Meta<typeof Header>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Closed: only the Menu button. Escape, an outside click, a link or Sign out close it. */
export const Closed: Story = {};

/** Open: the panel below the header. */
export const Open: Story = { args: { defaultOpen: true } };
