// Makes the *.module.scss declarations visible to apps that type-check this package's source.
// eslint-disable-next-line @typescript-eslint/triple-slash-reference
/// <reference path="./styles.d.ts" />
//
// Building blocks only: each shell owns its layout (src/layouts/ShellLayout, copied from a
// starter by `pnpm gen:shell`) and composes it from these. See README.md.
// This file is the package's public API; component folders have no index.ts of their own.
export { Brand } from './components/Brand/Brand';
export type { BrandProps } from './components/Brand/types';
export { Button } from './components/Button/Button';
export type {
  ButtonProps,
  ButtonSize,
  ButtonVariant,
} from './components/Button/types';
export {
  Alert,
  type AlertProps,
  type AlertVariant,
} from './components/Alert/Alert';
export {
  Badge,
  type BadgeProps,
  type BadgeVariant,
} from './components/Badge/Badge';
export { Card, type CardProps } from './components/Card/Card';
export { Checkbox, type CheckboxProps } from './components/Checkbox/Checkbox';
export { Combobox, type ComboboxProps } from './components/Combobox/Combobox';
export {
  DateField,
  type DateFieldProps,
} from './components/DateField/DateField';
export { Dialog, type DialogProps } from './components/Dialog/Dialog';
export {
  Field,
  type FieldControlProps,
  type FieldLabelProps,
  type FieldProps,
} from './components/Field/Field';
export {
  Icon,
  type IconProps,
  type IconSize,
  type IconTone,
} from './components/Icon/Icon';
// Icons: one component per file in src/icons (see README.md "Icons").
export { CheckIcon } from './icons/CheckIcon';
export { ChevronDownIcon } from './icons/ChevronDownIcon';
export { ChevronUpIcon } from './icons/ChevronUpIcon';
export { ChevronUpDownIcon } from './icons/ChevronUpDownIcon';
export { CloseIcon } from './icons/CloseIcon';
export { ErrorIcon } from './icons/ErrorIcon';
export { ExternalLinkIcon } from './icons/ExternalLinkIcon';
export { InfoIcon } from './icons/InfoIcon';
export { MenuIcon } from './icons/MenuIcon';
export { SearchIcon } from './icons/SearchIcon';
export { SuccessIcon } from './icons/SuccessIcon';
export { WarningIcon } from './icons/WarningIcon';
export {
  Link,
  type AnchorLinkVariantProps,
  type LinkProps,
  type RouterLinkVariantProps,
} from './components/Link/Link';
export {
  MenuDisclosure,
  type MenuDisclosureButtonProps,
  type MenuDisclosurePanelProps,
  type MenuDisclosureRootProps,
} from './components/MenuDisclosure/MenuDisclosure';
export {
  RadioGroup,
  type RadioGroupProps,
  type RadioOption,
} from './components/RadioGroup/RadioGroup';
export {
  Select,
  type SelectOption,
  type SelectProps,
} from './components/Select/Select';
export { Spinner, type SpinnerProps } from './components/Spinner/Spinner';
export {
  Table,
  type SortDirection,
  type TableColumn,
  type TableProps,
  type TableSort,
} from './components/Table/Table';
export { Tabs, type TabItem, type TabsProps } from './components/Tabs/Tabs';
export { TextArea, type TextAreaProps } from './components/TextArea/TextArea';
export {
  TextField,
  type TextFieldProps,
} from './components/TextField/TextField';
export {
  VisuallyHidden,
  type VisuallyHiddenProps,
} from './components/VisuallyHidden/VisuallyHidden';
export { SkipLink } from './components/SkipLink/SkipLink';
export type { SkipLinkProps } from './components/SkipLink/types';
export { ThemeToggle } from './components/ThemeToggle/ThemeToggle';
export type { ThemeToggleProps } from './components/ThemeToggle/types';
export { RemoteFallback } from './components/RemoteFallback/RemoteFallback';
export type { RemoteFallbackProps } from './components/RemoteFallback/types';
export {
  ConnectionRequired,
  type ConnectionRequiredProps,
} from './components/ConnectionRequired/ConnectionRequired';
export {
  FIT_HYSTERESIS_PX,
  decideFitLayout,
  measureFit,
  useFitLayout,
  type FitLayout,
  type FitLayoutOptions,
} from './hooks/useFitLayout/useFitLayout';
export {
  ThemeProvider,
  useTheme,
  type ThemeContextValue,
  type ThemeProviderProps,
  type ThemeRole,
} from './providers/ThemeProvider/ThemeProvider';
export type { ThemeMode, ThemePreference } from '@org/design-tokens';
