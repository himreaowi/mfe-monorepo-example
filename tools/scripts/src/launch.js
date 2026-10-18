// @ts-check
/**
 * Runs a long-lived command (the zone's `nx run-many -t dev`) and stops it cleanly.
 *
 * Stopping `nx run-many` kills its continuous tasks, and Nx then reports them as failed
 * ("Tasks not run because their dependencies failed or --nx-bail=true", "Tasks stopped before
 * they finished"), which looks like an error although the stop was intended. `launch()` passes
 * a stop signal on to the command, drops the command's output from then on (shutdown chatter),
 * waits until it exited and resolves 0 after printing one line. If the command exits on its own
 * (a server crashed, a port was taken), its output is shown in full and its exit code is kept.
 */
import { spawn } from 'node:child_process';

/** Signals that mean "stop the dev servers". */
export const STOP_SIGNALS = /** @type {const} */ ([
  'SIGINT',
  'SIGTERM',
  'SIGHUP',
]);

/**
 * @param {{
 *   command: string,
 *   args?: string[],
 *   cwd?: string,
 *   env?: NodeJS.ProcessEnv,
 *   label: string,
 *   stopTimeoutMs?: number,
 *   shell?: boolean,
 *   stdout?: NodeJS.WritableStream,
 *   stderr?: NodeJS.WritableStream,
 * }} options
 * @returns {Promise<number>} exit code for the launcher
 */
export function launch(options) {
  const {
    command,
    args = [],
    cwd,
    env = process.env,
    label,
    stopTimeoutMs = 15_000,
    shell = false,
    stdout = process.stdout,
    stderr = process.stderr,
  } = options;

  const child = spawn(command, args, {
    cwd,
    env,
    shell,
    stdio: ['inherit', 'pipe', 'pipe'],
  });

  /** @type {NodeJS.Signals | undefined} */
  let stopping;
  child.stdout?.on('data', (chunk) => {
    if (!stopping) stdout.write(chunk);
  });
  child.stderr?.on('data', (chunk) => {
    if (!stopping) stderr.write(chunk);
  });

  /** @param {NodeJS.Signals} signal */
  const stop = (signal) => {
    if (stopping) {
      // second Ctrl-C: do not wait any longer
      child.kill('SIGKILL');
      return;
    }
    stopping = signal;
    // In a terminal (Ctrl-C) and under Playwright (process-group SIGTERM) the command got the
    // signal too; passing it on covers a launcher that was signalled alone.
    child.kill(signal);
    setTimeout(() => child.kill('SIGKILL'), stopTimeoutMs).unref();
  };
  /** @type {[NodeJS.Signals, () => void][]} */
  const handlers = STOP_SIGNALS.map((signal) => [signal, () => stop(signal)]);
  for (const [signal, handler] of handlers) process.on(signal, handler);

  return new Promise((resolve) => {
    const done = (/** @type {number} */ code) => {
      for (const [signal, handler] of handlers) process.off(signal, handler);
      resolve(code);
    };
    child.on('error', (error) => {
      stderr.write(`${label}: could not start ${command}: ${error.message}\n`);
      done(1);
    });
    child.on('exit', (code, signal) => {
      if (stopping) {
        stderr.write(
          `${label}: dev servers stopped (${stopping}, expected).\n`,
        );
        done(0);
        return;
      }
      done(code ?? (signal ? 1 : 0));
    });
  });
}
