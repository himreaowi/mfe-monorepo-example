import { Icon, type IconProps } from '../components/Icon/Icon';

/** An "i" in a circle: information. Decorative unless you pass `label`. */
export function InfoIcon(props: Omit<IconProps, 'children'>) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5M12 8h.01" />
    </Icon>
  );
}
