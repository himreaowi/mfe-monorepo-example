export type RemoteFallbackProps = {
  reason?: string;
  title?: string;
  /** When set, a "Try again" button is shown. */
  onRetry?: () => void;
  retryLabel?: string;
};
