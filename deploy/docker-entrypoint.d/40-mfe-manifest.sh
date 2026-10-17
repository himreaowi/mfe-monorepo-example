#!/bin/sh
# Runs before nginx starts (nginx image entrypoint). Puts the per-environment mfe-manifest.json in
# place for a shell: MFE_MANIFEST_JSON (the JSON itself) is written to /etc/mfe/mfe-manifest.json,
# unless a file is already mounted there. Remotes do not need a manifest.
set -eu
target=/etc/mfe/mfe-manifest.json
if [ -n "${MFE_MANIFEST_JSON:-}" ]; then
  if [ -e "$target" ] && [ ! -w "$target" ]; then
    echo "40-mfe-manifest: $target is mounted read-only, ignoring MFE_MANIFEST_JSON" >&2
  else
    printf '%s\n' "$MFE_MANIFEST_JSON" > "$target"
    echo "40-mfe-manifest: wrote $target from MFE_MANIFEST_JSON"
  fi
fi
if [ ! -f "$target" ]; then
  echo "40-mfe-manifest: no $target (fine for a remote; a shell shows its start-up error without it)"
fi
