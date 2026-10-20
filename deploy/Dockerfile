# syntax=docker/dockerfile:1.7
#
# One image per app (shell or remote), all built from this one Dockerfile. Reference for DevOps
# (docs/devops-handoff.md); pin the base images by digest in your registry.
#
#   docker build -f deploy/Dockerfile --build-arg APP=@org/intranet-staff-directory \
#     -t staff-directory:<git sha> .
#   docker run -p 8080:8080 \
#     -e MFE_CORS_ORIGINS_REGEX='^https://portal\.example\.sg$' staff-directory:<git sha>
#
# Shells additionally get the per-environment /mfe-manifest.json at deploy time (never baked
# in): mount it at /etc/mfe/mfe-manifest.json, or pass MFE_MANIFEST_JSON. Same image for every
# environment.

ARG NODE_IMAGE=node:24-bookworm-slim
ARG NGINX_IMAGE=nginxinc/nginx-unprivileged:1.29-alpine

# ---------------------------------------------------------------------------------------------
# build: install only the selected app and the workspace packages it depends on, then build it
# ---------------------------------------------------------------------------------------------
FROM ${NODE_IMAGE} AS build
ENV CI=true \
    PNPM_HOME=/pnpm \
    PATH=/pnpm:$PATH \
    COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN corepack enable
WORKDIR /repo

# 1) Dependencies from the lockfile only: this layer is reused until pnpm-lock.yaml changes.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm config set store-dir /pnpm/store && pnpm fetch

# 2) Sources, then install the app + its workspace dependencies (`<app>...`) offline.
COPY . .
ARG APP
RUN test -n "$APP" || (echo "Build arg APP is required, e.g. --build-arg APP=@org/shell-intranet (see: pnpm -s apps)" && exit 1)
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm config set store-dir /pnpm/store \
    && pnpm install --frozen-lockfile --offline --filter "${APP}..."

# 3) Production build of that app, copied to /out (only static files leave this stage).
# A shell with a base path (package.json mfe.basePath, e.g. /citizen) is served below it:
# dist/ goes to html/citizen/ and nginx learns the path from mfe-base-path.inc.
RUN pnpm --filter "${APP}" run build \
    && APP_DIR="$(pnpm --filter "${APP}" exec pwd)" \
    && test -f "$APP_DIR/dist/index.html" \
    && BASE_PATH="$(node -p "String(require('$APP_DIR/package.json').mfe?.basePath ?? '/').replace(/\/+$/, '')")" \
    && mkdir -p "/out/html$BASE_PATH" \
    && cp -r "$APP_DIR/dist/." "/out/html$BASE_PATH/" \
    && printf 'set $mfe_base_path "%s";\n' "$BASE_PATH" > /out/mfe-base-path.inc \
    && if [ -n "$BASE_PATH" ]; then \
         printf 'location = / {\n    return 302 %s/;\n}\n' "$BASE_PATH" >> /out/mfe-base-path.inc; \
       fi

# ---------------------------------------------------------------------------------------------
# runtime: static files + nginx (non-root, port 8080)
# ---------------------------------------------------------------------------------------------
FROM ${NGINX_IMAGE} AS runtime

# Defaults for every ${VAR} in the nginx templates (the image's entrypoint runs envsubst on
# /etc/nginx/templates/*.template; an unset variable would stay literally in the config).
# Override per environment with -e / the orchestrator's env settings.
ENV NGINX_PORT=8080 \
    MFE_CORS_ORIGINS_REGEX='^$' \
    CSP_REMOTE_ORIGINS='' \
    CSP_BFF_ORIGINS='' \
    CSP_API_ORIGINS='' \
    CSP_VENDOR_ORIGINS='' \
    CSP_FRAME_SRC="'none'" \
    CSP_EXTRA='' \
    PERMISSIONS_POLICY='camera=(), microphone=(), geolocation=(), payment=()' \
    MFE_MANIFEST_JSON=''

COPY deploy/nginx/default.conf.template deploy/nginx/security-headers.inc.template /etc/nginx/templates/
COPY --chmod=755 deploy/docker-entrypoint.d/40-mfe-manifest.sh /docker-entrypoint.d/
COPY --from=build /out/html /usr/share/nginx/html
COPY --from=build /out/mfe-base-path.inc /etc/nginx/mfe-base-path.inc

USER root
# the default server config of the image is replaced by default.conf.template;
# /etc/mfe holds the per-environment mfe-manifest.json (mounted or written at start-up)
RUN rm -f /etc/nginx/conf.d/default.conf \
    && mkdir -p /etc/mfe && chown 101:101 /etc/mfe
USER 101

EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s CMD wget -q -O /dev/null http://127.0.0.1:8080/healthz || exit 1
