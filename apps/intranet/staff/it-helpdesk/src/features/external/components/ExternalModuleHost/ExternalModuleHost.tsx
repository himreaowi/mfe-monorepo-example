import { useCallback, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import {
  ExternalModule,
  type ExternalModuleReportedError,
  type ExternalNavigateOptions,
} from '@org/mf-runtime/external';
import { joinBasePath, useHostProps } from '@org/mf-runtime/remote';
import { RemoteFallback, Spinner, useTheme } from '@org/ui';
import { APP_TITLE, FEDERATION_NAME } from '@/core/constants/app';
import { describeError, describeEvent } from '../../utils/activity';
import { resolveVendorConfig } from '../../utils/vendorConfig';
import styles from './ExternalModuleHost.module.scss';

type LogEntry = { id: number; kind: 'event' | 'error'; text: string };

let nextId = 0;

/**
 * Adapter for the IT ticket desk, a vendor product (Acme Service Desk) integrated through the
 * mount contract (docs/external-modules.md): `<ExternalModule>` loads the vendor bundle (URL
 * and `config.apiBaseUrl` from mfe-manifest.json `props.vendor`) and drives
 * `mount(el, props) → { update, unmount }`.
 *
 * - `path` = everything below this remote's mount (the vendor routes on it: `new`,
 *   `tickets/<id>`); the vendor's `onNavigate` goes through the shell's router
 * - theme and user come from the shell; prop changes reach the vendor via `update()`
 * - vendor events (`ticket:created`) and errors are listed under "Activity"; a failure to load
 *   shows RemoteFallback, the shell keeps working
 */
export function ExternalModuleHost() {
  const { basePath, user, vendor } = useHostProps();
  const { theme } = useTheme();
  const path = useParams()['*'] ?? '';
  const navigate = useNavigate();
  const [log, setLog] = useState<LogEntry[]>([]);
  const config = resolveVendorConfig(vendor);

  const append = useCallback((kind: LogEntry['kind'], text: string) => {
    nextId += 1;
    setLog((entries) => [...entries.slice(-9), { id: nextId, kind, text }]);
  }, []);
  const onNavigate = useCallback(
    (to: string, options?: ExternalNavigateOptions) =>
      navigate(to.startsWith('/') ? to : joinBasePath(basePath, to), {
        replace: options?.replace,
      }),
    [navigate, basePath],
  );
  const onEvent = useCallback(
    (name: string, detail?: unknown) =>
      append('event', describeEvent(name, detail)),
    [append],
  );
  const onError = useCallback(
    (error: ExternalModuleReportedError) =>
      append('error', describeError(error)),
    [append],
  );

  return (
    <section className={styles.adapter} data-testid="external-adapter">
      <header className={styles.header}>
        <h1 className={styles.title}>{APP_TITLE}</h1>
        <p className={styles.muted}>
          Report a problem with your laptop, software or access, and follow your
          tickets.
        </p>
      </header>
      {config === undefined ? (
        <RemoteFallback
          title="Ticket desk not configured"
          reason={`Set "props.vendor" for ${FEDERATION_NAME} in mfe-manifest.json, e.g. { "url": "https://vendor.example/mount.js", "format": "esm" }.`}
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
          loading={<Spinner label="Loading the ticket desk…" labelVisible />}
        />
      )}
      <aside
        className={styles.events}
        aria-labelledby="vendor-events-title"
        data-testid="vendor-events"
      >
        <h2 id="vendor-events-title" className={styles.eventsTitle}>
          Activity
        </h2>
        <div aria-live="polite">
          {log.length === 0 ? (
            <p className={styles.muted}>Nothing yet in this session.</p>
          ) : (
            <ol className={styles.list}>
              {log.map((entry) => (
                <li key={entry.id} data-kind={entry.kind}>
                  {entry.text}
                </li>
              ))}
            </ol>
          )}
        </div>
      </aside>
    </section>
  );
}
