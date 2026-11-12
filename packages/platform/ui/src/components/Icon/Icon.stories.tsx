import type { Meta, StoryObj } from '@storybook/react-webpack5';
import {
  CheckIcon,
  ChevronDownIcon,
  ChevronUpDownIcon,
  ChevronUpIcon,
  CloseIcon,
  ErrorIcon,
  ExternalLinkIcon,
  InfoIcon,
  MenuIcon,
  SearchIcon,
  SuccessIcon,
  WarningIcon,
} from '../../index';
import { Icon, type IconSize, type IconTone } from './Icon';

const meta = {
  title: 'Components/Icons',
  component: Icon,
} satisfies Meta<typeof Icon>;

export default meta;
type Story = StoryObj<typeof meta>;

const ICONS = {
  CheckIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  ChevronUpDownIcon,
  CloseIcon,
  ErrorIcon,
  ExternalLinkIcon,
  InfoIcon,
  MenuIcon,
  SearchIcon,
  SuccessIcon,
  WarningIcon,
};
const TONES: IconTone[] = ['default', 'muted', 'accent', 'danger', 'success'];
const SIZES: IconSize[] = ['sm', 'md', 'lg'];

/** Every icon at `lg`, with its name. */
export const AllIcons: Story = {
  render: () => (
    <ul className="sb-grid">
      {Object.entries(ICONS).map(([name, Component]) => (
        <li key={name} className="sb-row">
          <Component size="lg" />
          <code>{name}</code>
        </li>
      ))}
    </ul>
  ),
};

/** Every icon in each tone (one row per tone). */
export const Tones: Story = {
  render: () => (
    <div className="sb-stack">
      {TONES.map((tone) => (
        <div key={tone} className="sb-row">
          <code>{tone}</code>
          {Object.entries(ICONS).map(([name, Component]) => (
            <Component key={name} tone={tone} size="md" />
          ))}
        </div>
      ))}
    </div>
  ),
};

/** Every icon in each size; the default (1em) follows the text. */
export const Sizes: Story = {
  render: () => (
    <div className="sb-stack">
      {SIZES.map((size) => (
        <div key={size} className="sb-row">
          <code>{size}</code>
          {Object.entries(ICONS).map(([name, Component]) => (
            <Component key={name} size={size} />
          ))}
        </div>
      ))}
      <p className="sb-flush">
        <InfoIcon /> Default size: 1em, in line with the text.
      </p>
    </div>
  ),
};

/** A meaningful icon has a label (`role="img"`); an icon-only button names the button. */
export const Labelled: Story = {
  render: () => (
    <div className="sb-row">
      <WarningIcon label="Warning" tone="danger" size="lg" />
      <button type="button" aria-label="Search">
        <SearchIcon size="md" />
      </button>
    </div>
  ),
};
