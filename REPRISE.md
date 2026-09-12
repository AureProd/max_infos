# Où on en est — reprise du chantier

> Dernière séance : **samedi 12 septembre 2026**. Reprise prévue **lundi 14 septembre 2026**.
> Pour reprendre : lancer `claude` dans `~/Documents/perso/max_infos` et dire
> « reprends le chantier, lis REPRISE.md ».

## Le plan

Le plan complet et approuvé est dans **[`docs/PLAN.md`](docs/PLAN.md)** : contexte, décisions
arrêtées, contraintes des API tierces, modèle de données, API, back-office, export/import,
Docker/Traefik/CI, qualité de code, découpage en 11 lots, procédure de vérification.

**Le lire en entier avant de coder.** Il contient des contraintes vérifiées qu'il ne faut pas
réapprendre (notamment : la découverte automatique LinkedIn est impossible, Substack n'a pas
d'API de publication, et le site **ne publie jamais** sur les réseaux).

## Avancement

| Lot | État |
|---|---|
| **1 — Dépôt, structure, outillage qualité, CI** | ✅ **terminé** |
| 2 — FastAPI + Postgres + Alembic + modèles + `./setup` + Traefik de dev | ⏭ **à faire, prochaine étape** |
| 3 → 11 | à faire, voir `docs/PLAN.md` |

### Ce que le lot 1 a livré

- Dépôt git initialisé (branche `main`), `.gitignore`, `.gitattributes`, `.dockerignore`
- `.env.example` documentant chaque variable ; **aucun secret dans le dépôt**
- `backend/` : squelette FastAPI (`app/main.py`, `app/core/config.py`, `app/core/db.py`,
  `app/routers/health.py`), Alembic configuré en asynchrone, `uv.lock` versionné
- `backend/deploy/Dockerfile` multi-étapes (Node compile le front → image Python), cibles
  `dev` et `prod`, utilisateur non-root, healthcheck
- Outillage : ruff, mypy strict, pytest (**8 tests, 100 % de couverture**), ESLint 10 +
  Prettier, Vitest (**5 tests**), pre-commit avec `detect-secrets` et Conventional Commits
- `.github/workflows/ci.yml` : 5 tâches (qualité, back, front, sécurité, image + Trivy)

### Détails d'implémentation à connaître

- `Settings` **refuse de démarrer en production** si un secret manque (voir
  `backend/app/core/config.py`) — les valeurs par défaut sont vides, jamais factices.
- Les `v-html` existants du front portent une dérogation ESLint **justifiée au cas par cas** ;
  ceux d'`ArticleView` et `AdminView` deviendront inutiles au lot 9, quand le Markdown sera
  assaini côté serveur avec `bleach`.
- `.secrets.baseline` est audité : les trois valeurs signalées sont des fixtures de test
  marquées `is_secret: false`. Toute **nouvelle** détection fera échouer le hook.
- La convention de nommage des contraintes SQL est posée dans `app/core/db.py` — indispensable
  pour que les migrations Alembic soient déterministes.

## À faire au démarrage du lot 2

1. `cd backend && uv sync` puis, à la racine,
   `uv run --project backend pre-commit install --install-hooks -t pre-commit -t commit-msg`
2. Écrire les modèles SQLAlchemy (tableau du modèle de données dans `docs/PLAN.md`)
3. Écrire `deploy/docker-compose.yml` + les overrides `dev` et `prod`, et le script `./setup`
4. Générer la première migration, vérifier `docker compose up -d --wait`

## Décisions encore ouvertes (aucune ne bloque le lot 2)

- Créer l'app Meta et connecter le compte Instagram (le compte @unmaxdinfo_ **est déjà passé en
  Pro**) — nécessaire seulement au lot 6
- Acheter `unmaxdinfo.fr` chez Infomaniak et déléguer le DNS à Cloudflare — nécessaire au lot 11
- Créer le bucket Cloudflare R2 et ses clés — nécessaire au lot 5
- Créer le dépôt GitHub privé et y pousser `main`
