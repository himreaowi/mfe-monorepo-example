import { Icon, type IconProps } from '../components/Icon/Icon';

/** Three bars: a menu button. Decorative unless you pass `label`. */
export function MenuIcon(props: Omit<IconProps, 'children'>) {
  return (
    <Icon {...props}>
      <path d="M4 6h16M4 12h16M4 18h16" />
    </Icon>
  );
}
