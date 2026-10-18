import { useCallback, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import {
  ExternalModule,
  type ExternalModuleReportedError,
  type ExternalNavigateOptions,
} from '@org/mf-runtime/external';
import { joinBasePath, useHostProps } from '@org/mf-runtime/remote';
import { RemoteFallback, useTheme } from '@org/ui';
import { APP_TITLE, FEDERATION_NAME } from '@/core/constants/app';
import {
  describeError,
  formatAmount,
  readCompletedPayment,
  type CompletedPayment,
} from '../../utils/payment';
import { resolveVendorConfig } from '../../utils/vendorConfig';
import styles from './ExternalModuleHost.module.scss';

/**
 * Adapter for online payments, a vendor product (Bright Payments, a web component) integrated
 * through the mount contract (docs/external-modules.md). The bill (`config.description`,
 * `amount`) and the vendor URL come from mfe-manifest.json `props.vendor`.
 *
 * - `path` = everything below this remote's mount (the vendor shows `receipt/<reference>`);
 *   the vendor navigates through the shell's router
 * - the vendor's `payment:completed` event is validated and confirmed by the portal (in a real
 *   app: record it with our backend, which confirms it with the payment provider)
 * - errors are shown; a failure to load shows RemoteFallback, the shell keeps working
 */
export function ExternalModuleHost() {
  const { basePath, user, vendor } = useHostProps();
  const { theme } = useTheme();
  const path = useParams()['*'] ?? '';
  const navigate = useNavigate();
  const [payment, setPayment] = useState<CompletedPayment | null>(null);
  const [problem, setProblem] = useState('');
  const config = resolveVendorConfig(vendor);

  const onNavigate = useCallback(
    (to: string, options?: ExternalNavigateOptions) =>
      navigate(to.startsWith('/') ? to : joinBasePath(basePath, to), {
        replace: options?.replace,
      }),
    [navigate, basePath],
  );
  const onEvent = useCallback((name: string, detail?: unknown) => {
    if (name !== 'payment:completed') return;
    const completed = readCompletedPayment(detail);
    if (completed) {
      setPayment(completed);
      setProblem('');
    }
  }, []);
  const onError = useCallback(
    (error: ExternalModuleReportedError) => setProblem(describeError(error)),
    [],
  );

  return (
    <section className={styles.adapter} data-testid="external-adapter">
      <header className={styles.header}>
        <h1 className={styles.title}>{APP_TITLE}</h1>
        <p className={styles.muted}>
          Pay securely online. Card and bank details go to our payment provider
          only; this portal never sees them.
        </p>
      </header>
      <div aria-live="polite">
        {payment ? (
          <p className={styles.confirmation} data-testid="payment-confirmation">
            Payment received: {formatAmount(payment.amount, payment.currency)}{' '}
            for {payment.description}. Reference {payment.reference}. We have
            emailed you a receipt.
          </p>
        ) : null}
      </div>
      {problem ? (
        <p className={styles.problem} role="alert">
          {problem}
        </p>
      ) : null}
      {config === undefined ? (
        <RemoteFallback
          title="Payments not configured"
          reason={`Set "props.vendor" for ${FEDERATION_NAME} in mfe-manifest.json, e.g. { "url": "https://vendor.example/element.js", "format": "web-component", "tagName": "…" }.`}
        />
      ) : (
        <ExternalModule
          name={FEDERATION_NAME}
          config={config}
          basePath={basePath}
          path={path}
          theme={theme}
          user={
            user ? { id: user.id, name: user.name, roles: user.roles } : null
          }
          onNavigate={onNavigate}
          onEvent={onEvent}
          onError={onError}
          loading={<p role="status">Loading the payment service…</p>}
        />
      )}
    </section>
  );
}
