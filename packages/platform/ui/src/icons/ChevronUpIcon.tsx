import { Icon, type IconProps } from '../components/Icon/Icon';

/** Points up: close, sorted ascending. Decorative unless you pass `label`. */
export function ChevronUpIcon(props: Omit<IconProps, 'children'>) {
  return (
    <Icon {...props}>
      <path d="M6 15l6-6 6 6" />
    </Icon>
  );
}
