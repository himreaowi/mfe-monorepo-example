// @ts-check
/** @typedef {import('./check-versions.js').Issue} Issue */

/**
 * Human-readable report. Errors first, grouped by check.
 * @param {{ errors: Issue[], warnings: Issue[] }} result
 * @param {string[]} checks names of the checks that ran
 */
export function formatReport({ errors, warnings }, checks) {
  const lines = [];
  for (const w of warnings)
    lines.push(`warning [${w.check}/${w.rule}] ${w.message}`);
  for (const e of errors)
    lines.push(`error   [${e.check}/${e.rule}] ${e.message}`);
  lines.push(
    errors.length === 0
      ? `✔ ${checks.join(', ')}: OK${warnings.length ? ` (${warnings.length} warning${warnings.length > 1 ? 's' : ''})` : ''}`
      : `✖ ${checks.join(', ')}: ${errors.length} error${errors.length > 1 ? 's' : ''}${warnings.length ? `, ${warnings.length} warning${warnings.length > 1 ? 's' : ''}` : ''}. How to fix each one: docs/guardrails.md`,
  );
  return lines.join('\n');
}
