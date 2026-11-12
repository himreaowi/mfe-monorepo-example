import { Icon, type IconProps } from '../components/Icon/Icon';

/** An arrow out of a box: opens another site or a new tab. Decorative unless you pass `label`. */
export function ExternalLinkIcon(props: Omit<IconProps, 'children'>) {
  return (
    <Icon {...props}>
      <path d="M14 4h6v6M20 4l-9 9" />
      <path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" />
    </Icon>
  );
}
