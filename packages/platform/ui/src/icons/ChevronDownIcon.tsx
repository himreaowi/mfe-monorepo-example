import { Icon, type IconProps } from '../components/Icon/Icon';

/** Points down: open, sorted descending. Decorative unless you pass `label`. */
export function ChevronDownIcon(props: Omit<IconProps, 'children'>) {
  return (
    <Icon {...props}>
      <path d="M6 9l6 6 6-6" />
    </Icon>
  );
}
