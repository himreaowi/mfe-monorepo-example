import { Icon, type IconProps } from '../components/Icon/Icon';

/** Up and down: sortable, not sorted yet. Decorative unless you pass `label`. */
export function ChevronUpDownIcon(props: Omit<IconProps, 'children'>) {
  return (
    <Icon {...props}>
      <path d="M8 9.5l4-4 4 4M8 14.5l4 4 4-4" />
    </Icon>
  );
}
