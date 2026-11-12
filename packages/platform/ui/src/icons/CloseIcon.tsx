import { Icon, type IconProps } from '../components/Icon/Icon';

/** A cross (×): close a dialog, clear a field. Decorative unless you pass `label`. */
export function CloseIcon(props: Omit<IconProps, 'children'>) {
  return (
    <Icon {...props}>
      <path d="M6 6l12 12M18 6L6 18" />
    </Icon>
  );
}
