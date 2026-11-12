import { Icon, type IconProps } from '../components/Icon/Icon';

/** An "!" in a triangle: warning. Decorative unless you pass `label`. */
export function WarningIcon(props: Omit<IconProps, 'children'>) {
  return (
    <Icon {...props}>
      <path d="M12 3.5L21.5 20h-19z" />
      <path d="M12 10v4M12 17h.01" />
    </Icon>
  );
}
