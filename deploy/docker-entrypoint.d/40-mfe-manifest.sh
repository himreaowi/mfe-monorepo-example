#!/bin/sh
# Runs before nginx starts (nginx image entrypoint, after the envsubst of the config templates).
# For a SHELL image it
#   1. generates /etc/mfe/mfe-manifest.json from individual variables (below), validating them and
#      failing fast with a list of everything that is wrong, and
#   2. writes /etc/mfe/mfe-proxy.inc, the same-origin proxy locations nginx includes:
#        <base>/api/...   -> API_UPSTREAM        (server side only, never in the browser)
#        <base>/auth/...  -> AUTH_UPSTREAM       (the sign-in BFF, when the shell has auth)
#      <base> is the shell's base path (package.json mfe.basePath, "" for a shell at /).
# A REMOTE image only gets an empty proxy include. docs/configuration.md describes the variables.
#
# Variables (the same names as in apps/<zone>/.env.example):
#   API_UPSTREAM     URL the shell's <base>/api is forwarded to, e.g. https://api.uat.example.sg/v1
#                    (the rest of the path is appended). Optional; without it <base>/api answers 503.
#   AUTH_UPSTREAM    URL of the sign-in BFF behind <base>/auth. Required when the shell has auth.
#   REMOTE_<FEDERATION_NAME>_URL
#                    entry URL (mf-manifest.json) of each remote the shell registers; the federation
#                    name upper-cased, e.g. REMOTE_INTRANET_STAFF_DIRECTORY_URL. Required.
#   REMOTE_<FEDERATION_NAME>_PROPS
#                    optional: that remote's extra props as one JSON object on one line.
#   MFE_ENVIRONMENT  optional: settings.environment (e.g. uat, production).
#   MFE_MANIFEST_JSON or a file mounted read-only at /etc/mfe/mfe-manifest.json: a complete manifest,
#                    used as is instead of generating one (the earlier way; no validation here, run
#                    `pnpm validate-manifest` in CI).
# Which remotes, base path and auth the shell has comes from /etc/nginx/mfe-shell.env, written by
# deploy/write-shell-env.mjs while the image is built.
#
# For tests: MFE_ETC_DIR (default /etc/mfe), MFE_SHELL_ENV (default /etc/nginx/mfe-shell.env).
set -eu

etc_dir=${MFE_ETC_DIR:-/etc/mfe}
shell_env=${MFE_SHELL_ENV:-/etc/nginx/mfe-shell.env}
target=$etc_dir/mfe-manifest.json
proxy_inc=$etc_dir/mfe-proxy.inc
say() { echo "40-mfe-manifest: $*"; }

MFE_IS_SHELL=0
MFE_BASE_PATH=
MFE_REMOTES=
MFE_AUTH=0
if [ -f "$shell_env" ]; then
  # shellcheck disable=SC1090
  . "$shell_env"
fi
mkdir -p "$etc_dir"

problems=
problem() { problems="$problems  - $*
"; }
fail() {
  {
    echo "40-mfe-manifest: the configuration of this shell is invalid, not starting:"
    printf '%s' "$problems"
    echo "See docs/configuration.md (variables) and deploy/README.md."
  } >&2
  exit 1
}

# $1 = value; true for http(s)://host[:port][/path] without anything nginx or JSON could misread
valid_upstream() {
  printf '%s\n' "$1" | grep -Eq '^https?://([A-Za-z0-9._-]+|\[[0-9A-Fa-f:]+\])(:[0-9]{1,5})?(/[A-Za-z0-9._~%/+:@-]*)?$'
}
# $1 = value; the manifest schema's remote entry pattern (without quotes and backslashes)
valid_entry() {
  printf '%s\n' "$1" | grep -Eq '^(https?://[^[:space:]/"\\]+)?/[^[:space:]"\\]*\.(json|js)(\?[^[:space:]"\\]*)?$'
}
# $1 = value; production entries must use https (http only for localhost, like validate-manifest)
secure_entry() {
  case "$1" in
    http://localhost[:/]* | http://127.0.0.1[:/]* | 'http://[::1]'[:/]*) return 0 ;;
    http://*) return 1 ;;
  esac
  return 0
}
# $1 = variable name; value of that variable ('' when unset)
value_of() { eval "printf '%s' \"\${$1:-}\""; }
# strip trailing slashes
trim_slash() { printf '%s' "$1" | sed 's|/*$||'; }

api_upstream=$(trim_slash "$(value_of API_UPSTREAM)")
auth_upstream=$(trim_slash "$(value_of AUTH_UPSTREAM)")
[ -z "$api_upstream" ] || valid_upstream "$api_upstream" || problem "API_UPSTREAM=$api_upstream is not a http(s)://host[:port][/path] URL"
[ -z "$auth_upstream" ] || valid_upstream "$auth_upstream" || problem "AUTH_UPSTREAM=$auth_upstream is not a http(s)://host[:port][/path] URL"

override=0
if [ -n "${MFE_MANIFEST_JSON:-}" ]; then
  if [ -e "$target" ] && [ ! -w "$target" ]; then
    say "$target is mounted read-only, ignoring MFE_MANIFEST_JSON"
  else
    printf '%s\n' "$MFE_MANIFEST_JSON" > "$target"
    say "wrote $target from MFE_MANIFEST_JSON"
  fi
  override=1
elif [ -e "$target" ] && [ ! -w "$target" ]; then
  say "using the mounted $target (variables are not used for the manifest)"
  override=1
fi

# --- manifest from variables (shell images) ----------------------------------------------------
if [ "$MFE_IS_SHELL" = 1 ] && [ "$override" = 0 ]; then
  sep=
  remotes=
  for name in $MFE_REMOTES; do
    upper=$(printf '%s' "$name" | tr 'a-z' 'A-Z')
    url_var=REMOTE_${upper}_URL
    props_var=REMOTE_${upper}_PROPS
    url=$(value_of "$url_var")
    props=$(value_of "$props_var")
    if [ -z "$url" ]; then
      problem "$url_var is not set (entry URL of remote $name, e.g. https://<host>/mf-manifest.json)"
      continue
    fi
    if ! valid_entry "$url"; then
      problem "$url_var=$url is not an absolute https URL or a /path ending in .json or .js"
      continue
    fi
    secure_entry "$url" || problem "$url_var=$url must use https (http is only allowed for localhost)"
    entry="\"entry\": \"$url\""
    if [ -n "$props" ]; then
      case "$props" in
        '{'*'}') entry="$entry, \"props\": $props" ;;
        *) problem "$props_var must be one JSON object on one line, e.g. {\"title\":\"Leave\"}" ;;
      esac
    fi
    remotes="$remotes$sep
    \"$name\": { $entry }"
    sep=,
  done

  auth=
  if [ "$MFE_AUTH" = 1 ]; then
    if [ -z "$auth_upstream" ]; then
      problem "AUTH_UPSTREAM is not set (this shell has sign-in: the BFF behind $MFE_BASE_PATH/auth)"
    fi
    auth=",
  \"auth\": {
    \"sessionUrl\": \"$MFE_BASE_PATH/auth/session\",
    \"loginUrl\": \"$MFE_BASE_PATH/auth/login\",
    \"logoutUrl\": \"$MFE_BASE_PATH/auth/logout\"
  }"
  fi

  settings=
  settings_sep=
  if [ -n "$api_upstream" ]; then
    settings="\"apiBaseUrl\": \"$MFE_BASE_PATH/api\""
    settings_sep=", "
  else
    say "warning: API_UPSTREAM is not set, $MFE_BASE_PATH/api will answer 503 and no apiBaseUrl is published"
  fi
  environment=$(value_of MFE_ENVIRONMENT)
  if [ -n "$environment" ]; then
    if printf '%s\n' "$environment" | grep -Eq '^[A-Za-z0-9._ -]+$'; then
      settings="$settings$settings_sep\"environment\": \"$environment\""
    else
      problem "MFE_ENVIRONMENT=$environment may only contain letters, digits, space, . _ -"
    fi
  fi
  [ -z "$problems" ] || fail
  cat > "$target.tmp" <<MANIFEST
{
  "remotes": {$remotes
  }$auth,
  "settings": { $settings }
}
MANIFEST
  mv "$target.tmp" "$target"
  say "generated $target ($(printf '%s' "$MFE_REMOTES" | wc -w | tr -d ' ') remotes, api=$([ -n "$api_upstream" ] && echo yes || echo no), auth=$MFE_AUTH)"
fi
[ -z "$problems" ] || fail

# --- same-origin proxy locations ---------------------------------------------------------------
# $1 = location prefix (<base>/api or <base>/auth), $2 = upstream URL, $3 = variable name
proxy_location() {
  prefix=$1
  upstream=$2
  variable=$3
  if [ -z "$upstream" ]; then
    cat <<LOCATION
location ^~ $prefix/ {
    default_type text/plain;
    add_header Cache-Control "no-store" always;
    include /etc/nginx/conf.d/security-headers.inc;
    return 503 "$prefix is not configured on this server ($variable is not set)\n";
}
LOCATION
    return
  fi
  tls=
  case "$upstream" in
    https://*)
      tls="
    proxy_ssl_verify on;
    proxy_ssl_trusted_certificate /etc/ssl/certs/ca-certificates.crt;"
      ;;
  esac
  cat <<LOCATION
location ^~ $prefix/ {
    proxy_pass $upstream/;
    include /etc/nginx/conf.d/proxy-common.inc;
    proxy_set_header X-Forwarded-Prefix $prefix;$tls
    proxy_hide_header Cache-Control;
    add_header Cache-Control "no-store" always;
    include /etc/nginx/conf.d/security-headers.inc;
}
LOCATION
}

{
  if [ "$MFE_IS_SHELL" = 1 ]; then
    echo "# generated by 40-mfe-manifest.sh from API_UPSTREAM / AUTH_UPSTREAM; do not edit"
    if [ "$override" = 1 ]; then
      # a complete manifest was supplied: proxy only what the operator configured
      [ -z "$api_upstream" ] || proxy_location "$MFE_BASE_PATH/api" "$api_upstream" API_UPSTREAM
      [ -z "$auth_upstream" ] || proxy_location "$MFE_BASE_PATH/auth" "$auth_upstream" AUTH_UPSTREAM
    else
      proxy_location "$MFE_BASE_PATH/api" "$api_upstream" API_UPSTREAM
      if [ "$MFE_AUTH" = 1 ]; then
        proxy_location "$MFE_BASE_PATH/auth" "$auth_upstream" AUTH_UPSTREAM
      fi
    fi
  fi
} > "$proxy_inc"

if [ ! -f "$target" ]; then
  say "no $target (fine for a remote; a shell shows its start-up error without it)"
fi
