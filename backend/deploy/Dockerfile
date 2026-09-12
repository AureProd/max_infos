# syntax=docker/dockerfile:1.9
# Contexte de build : la RACINE du dépôt (le front et le back entrent dans la même image).
#
#   base ──▶ frontend-build ─┐
#     └────▶ deps ───────────┼─▶ dev
#                            └─▶ prod

# ---------------------------------------------------------------------------
# Le front est compilé par Node, puis seul `dist/` traverse vers l'image Python.
FROM node:22-alpine AS frontend-build
WORKDIR /front
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# ---------------------------------------------------------------------------
FROM python:3.12-slim AS base
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    TZ=Europe/Paris \
    LANG=fr_FR.UTF-8
RUN apt-get update \
 && apt-get upgrade -y \
 && apt-get install -y --no-install-recommends ca-certificates curl locales tzdata \
 && sed -i 's/^# *\(fr_FR.UTF-8\)/\1/' /etc/locale.gen && locale-gen \
 && rm -rf /var/lib/apt/lists/* \
 # Réduction de la surface d'attaque : l'image finale n'installe plus rien.
 && pip uninstall -y pip setuptools wheel 2>/dev/null || true
COPY --from=ghcr.io/astral-sh/uv:0.11.2 /uv /uvx /usr/local/bin/

# ---------------------------------------------------------------------------
# Les dépendances sont résolues dans leur propre couche : le cache survit à
# toute modification du code source.
FROM base AS deps
WORKDIR /app
COPY backend/pyproject.toml backend/uv.lock ./
RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --frozen --no-dev --no-install-project

FROM deps AS deps-dev
RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --frozen --no-install-project

# ---------------------------------------------------------------------------
FROM base AS dev
WORKDIR /app
ENV PATH="/app/.venv/bin:$PATH" APP_ENV=dev
COPY --from=deps-dev /app/.venv /app/.venv
COPY backend/ /app/
EXPOSE 80
CMD ["python", "-m", "app"]

# ---------------------------------------------------------------------------
FROM base AS prod
WORKDIR /app
ENV PATH="/app/.venv/bin:$PATH" APP_ENV=prod
RUN useradd --system --create-home --uid 10001 app
COPY --from=deps /app/.venv /app/.venv
COPY backend/app /app/app
COPY backend/migrations /app/migrations
COPY backend/alembic.ini /app/alembic.ini
COPY --from=frontend-build /front/dist /app/static
USER app
EXPOSE 80
HEALTHCHECK --interval=15s --timeout=5s --start-period=20s --retries=5 \
    CMD curl -fsS http://localhost:80/api/health || exit 1
CMD ["python", "-m", "app"]
