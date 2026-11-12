import { Icon, type IconProps } from '../components/Icon/Icon';

/** A tick in a circle: success. Decorative unless you pass `label`. */
export function SuccessIcon(props: Omit<IconProps, 'children'>) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M8 12.5l2.5 2.5L16 9.5" />
    </Icon>
  );
}
