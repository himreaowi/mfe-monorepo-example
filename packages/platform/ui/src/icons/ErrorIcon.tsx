import { Icon, type IconProps } from '../components/Icon/Icon';

/** A cross in a circle: error. Decorative unless you pass `label`. */
export function ErrorIcon(props: Omit<IconProps, 'children'>) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M9 9l6 6M15 9l-6 6" />
    </Icon>
  );
}
