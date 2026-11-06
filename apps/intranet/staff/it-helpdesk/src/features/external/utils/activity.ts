import type { ExternalModuleReportedError } from '@org/mf-runtime/external';

/** Untrusted vendor event detail → a short message for the activity list. */
export function describeEvent(name: string, detail: unknown): string {
  const data =
    typeof detail === 'object' && detail !== null
      ? (detail as Record<string, unknown>)
      : {};
  if (name === 'ticket:created' && typeof data.id === 'string') {
    const summary = typeof data.summary === 'string' ? `: ${data.summary}` : '';
    return `Ticket ${data.id} created${summary}`;
  }
  return `The ticket desk reported "${name}"`;
}

export function describeError(error: ExternalModuleReportedError): string {
  return error.source === 'host'
    ? `The ticket desk could not be loaded (${error.code}).`
    : `The ticket desk reported a problem: ${error.message}`;
}
