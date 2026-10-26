/** Join class names, skipping empty values: `cx(styles.a, isB && styles.b, className)`. */
export function cx(...names: (string | false | null | undefined)[]): string {
  return names.filter(Boolean).join(' ');
}
