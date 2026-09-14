# syntax=docker/dockerfile:1.9
# Contexte de build : la RACINE du dépôt.
#
#   base ──▶ deps ──┬──▶ dev
#                   ├──▶ migrate
#                   └──▶ build ──▶ prod

# --------------------------------------------------------------------- base
# bookworm-slim et non alpine : la locale fr_FR.UTF-8 exige la glibc (musl
# n'a que C.UTF-8), et on veut curl pour le HEALTHCHECK sans surprise sur
# les binaires natifs. Coût : ~40 Mo.
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
 # Le corepack embarqué dans node:22 porte des clés de signature périmées :
 # pnpm échoue en « Cannot find matching keyid ». On le remplace avant de
 # l'activer.
 && npm i -g corepack@latest && corepack enable \
 && npm cache clean --force
WORKDIR /app

# --------------------------------------------------------------------- deps
# Couche dédiée. Deux mécanismes de cache distincts, à ne pas confondre :
#  - la COUCHE Docker : seuls package.json et le lockfile sont copiés avant
#    l'installation, donc la couche est réutilisée tant que le lockfile ne
#    bouge pas, quel que soit le code modifié ;
#  - le MAGASIN pnpm : gardé hors de l'image par --mount=type=cache, donc
#    sans poids ajouté, et partagé entre builds.
# Piège à ne pas « corriger » : un lien dur ne traverse pas la frontière du
# montage de cache, donc pnpm bascule silencieusement en copie. C'est
# correct, simplement un peu plus lent.
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm config set store-dir /pnpm/store \
 && pnpm install --frozen-lockfile --ignore-scripts=false

# ---------------------------------------------------------------------- dev
FROM deps AS dev
ENV NODE_ENV=development
COPY . .
# 3000 : le serveur Nuxt. 24678 : le WebSocket de rechargement à chaud, que
# Vite ouvre à part quand Nuxt le lance en middlewareMode.
EXPOSE 3000 24678
# --host : sans lui, nuxi n'écoute que la boucle locale DU CONTENEUR et
# Traefik ne l'atteint jamais.
CMD ["pnpm", "dev", "--host", "0.0.0.0", "--port", "3000"]

# ------------------------------------------------------------------ migrate
# Image éphémère : drizzle-kit a besoin du node_modules complet, qu'on
# refuse d'embarquer dans l'image de production.
FROM deps AS migrate
ENV NODE_ENV=production
COPY . .
USER node
CMD ["pnpm", "exec", "drizzle-kit", "migrate"]

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
 # Aucun outil d'installation dans l'image finale : équivalent du
 # `pip uninstall pip setuptools wheel` de l'ancienne image Python.
 && rm -rf /pnpm \
           /usr/local/lib/node_modules/corepack \
           /usr/local/lib/node_modules/npm \
           /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack
# Pas de node_modules ici : Nitro regroupe l'application et ses dépendances
# dans .output/server/. Le copier en plus serait du poids mort et de la
# surface d'attaque.
COPY --from=build --chown=10001:10001 /app/.output ./.output
USER 10001
EXPOSE 3000
HEALTHCHECK --interval=15s --timeout=5s --start-period=20s --retries=5 \
    CMD curl -fsS http://127.0.0.1:3000/api/health || exit 1
# Forme exec obligatoire : avec un shell, SIGTERM n'atteindrait pas Node et
# l'arrêt propre de Nitro ne se déclencherait pas.
CMD ["node", ".output/server/index.mjs"]
