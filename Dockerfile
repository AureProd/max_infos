# syntax=docker/dockerfile:1.9
# Build context: the ROOT of the repository.
#
#   base ──▶ deps ──┬──▶ dev
#                   ├──▶ migrate
#                   └──▶ build ──▶ prod

# --------------------------------------------------------------------- base
# bookworm-slim and not alpine: the fr_FR.UTF-8 locale requires glibc (musl
# only has C.UTF-8), and we want curl for the HEALTHCHECK without surprises
# on native binaries. Cost: ~40 MB.
FROM node:22-bookworm-slim AS base
ENV TZ=Europe/Paris \
    LANG=fr_FR.UTF-8 \
    NUXT_TELEMETRY_DISABLED=1 \
    PNPM_HOME=/pnpm \
    PATH=/pnpm/bin:$PATH
RUN apt-get update \
 && apt-get upgrade -y \
 && apt-get install -y --no-install-recommends ca-certificates curl locales tzdata \
 && sed -i 's/^# *\(fr_FR.UTF-8\)/\1/' /etc/locale.gen && locale-gen \
 && rm -rf /var/lib/apt/lists/* \
 # The corepack bundled in node:22 carries expired signing keys: pnpm fails
 # with « Cannot find matching keyid ». We replace it before enabling it.
 && npm i -g corepack@latest && corepack enable \
 # `corepack enable` only drops launchers: pnpm would be downloaded ON THE
 # FIRST CALL, that is at container startup. Unacceptable for the migration
 # container, which would then run mid-deployment with a network
 # dependency. We pin it here.
 && corepack prepare pnpm@12.4.1 --activate \
 && npm cache clean --force
WORKDIR /app

# --------------------------------------------------------------------- deps
# A dedicated layer. Two distinct cache mechanisms, not to be confused:
#  - the Docker LAYER: only package.json and the lockfile are copied before
#    installing, so the layer is reused as long as the lockfile does not
#    move, whatever code changed;
#  - the pnpm STORE: kept out of the image by --mount=type=cache, so with no
#    added weight, and shared between builds.
# A trap not to « fix »: a hard link does not cross the cache mount
# boundary, so pnpm silently falls back to copying. That is correct, simply
# a little slower.
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
# The `prepare` script runs during the install, so it must exist by then.
# It installs the Git hooks — and does nothing here, since this stage has no
# .git. Without this copy, the install fails on a module not found, and with
# it the whole image build.
COPY scripts/hooks/install.mjs ./scripts/hooks/
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm config set store-dir /pnpm/store \
 && pnpm install --frozen-lockfile --ignore-scripts=false

# ---------------------------------------------------------------------- dev
FROM deps AS dev
ENV NODE_ENV=development
COPY . .
# A single port: the hot-reload WebSocket is carried by this same server,
# on /_nuxt/_nuxt_hmr.
EXPOSE 3000
# --host: without it, nuxi only listens on the CONTAINER's loopback and
# Traefik never reaches it.
CMD ["pnpm", "dev", "--host", "0.0.0.0", "--port", "3000"]

# ------------------------------------------------------------------ migrate
# An ephemeral image: drizzle-kit needs the full node_modules, which we
# refuse to ship in the production image.
FROM deps AS migrate
ENV NODE_ENV=production
COPY . .
USER node
# The binary directly, and not `pnpm exec`: pnpm checks the installation
# along the way and tries to write into /app, owned by root — which an
# unprivileged migration container cannot do, and has no reason to do.
CMD ["node_modules/.bin/drizzle-kit", "migrate"]

# -------------------------------------------------------------------- build
FROM deps AS build
ENV NODE_ENV=production
COPY . .
RUN pnpm build

# --------------------------------------------------------------------- prod
FROM base AS prod
ENV NODE_ENV=production \
    NITRO_PORT=3000 \
    NITRO_HOST=0.0.0.0
RUN useradd --system --create-home --uid 10001 app \
 # No installation tooling in the final image: the equivalent of the old
 # Python image's `pip uninstall pip setuptools wheel`.
 && rm -rf /pnpm \
           /usr/local/lib/node_modules/corepack \
           /usr/local/lib/node_modules/npm \
           /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack
# No node_modules here: Nitro bundles the application and its dependencies
# into .output/server/. Copying it as well would be dead weight and attack
# surface.
COPY --from=build --chown=10001:10001 /app/.output ./.output
USER 10001
EXPOSE 3000
HEALTHCHECK --interval=15s --timeout=5s --start-period=20s --retries=5 \
    CMD curl -fsS http://127.0.0.1:3000/api/health || exit 1
# The exec form is mandatory: with a shell, SIGTERM would not reach Node and
# Nitro's graceful shutdown would never fire.
CMD ["node", ".output/server/index.mjs"]
