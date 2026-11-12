import { Icon, type IconProps } from '../components/Icon/Icon';

/** A magnifying glass: search. Decorative unless you pass `label`. */
export function SearchIcon(props: Omit<IconProps, 'children'>) {
  return (
    <Icon {...props}>
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="M15.5 15.5L20 20" />
    </Icon>
  );
}
