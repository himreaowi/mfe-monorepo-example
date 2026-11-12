import { Icon, type IconProps } from '../components/Icon/Icon';

/** A tick: done, selected. Decorative unless you pass `label`. */
export function CheckIcon(props: Omit<IconProps, 'children'>) {
  return (
    <Icon {...props}>
      <path d="M5 12.5l4.5 4.5L19 7.5" />
    </Icon>
  );
}
