# unmaxdinfo.fr

Site et back-office de **Un Max d'info**, le travail journalistique de
Maximilien Huet : articles longs, déclinés en publications Instagram et
LinkedIn.

Le plan complet du chantier — architecture, modèle de données, découpage en
lots, procédure de vérification — vit dans **[`docs/PLAN.md`](docs/PLAN.md)**.
Si tu découvres la pile (pnpm, Nuxt, Biome, Drizzle, Vitest), commence par
**[`docs/OUTILS.md`](docs/OUTILS.md)** : à quoi sert chaque outil, et les
trois commandes qui comptent pour chacun.

---

## Démarrer

Il faut **Docker** (≥ 28) et **Node 22.19+**. Rien d'autre.

```bash
corepack enable pnpm            # la première fois seulement
pnpm install

./setup                         # crée .env.dev et génère les secrets locaux
./setup                         # relancer : produit le docker-compose.yml

docker compose run --rm migrate # applique les migrations
docker compose up -d --wait     # démarre la pile
```

Trois adresses :

| | |
|---|---|
| Le site | <http://unmaxdinfo.localhost:8080> |
| La sonde | <http://unmaxdinfo.localhost:8080/api/health> |
| Le tableau de bord Traefik | <http://localhost:18080> |

`unmaxdinfo.localhost` résout nativement vers `127.0.0.1` dans Chrome et
Firefox : **il n'y a rien à écrire dans `/etc/hosts`**.

Pour arrêter : `docker compose down`. Pour repartir d'une base vierge :
`docker compose down -v`.

---

## Les commandes

| Ce que je veux faire | Commande |
|---|---|
| Installer les dépendances | `pnpm install` |
| Ajouter une dépendance / de développement | `pnpm add <paquet>` / `pnpm add -D <paquet>` |
| Démarrer le site | `./setup && docker compose up -d --wait` |
| Voir les journaux | `docker compose logs -f app` |
| Savoir sur quoi ce dossier est réglé | `./setup --show` |
| Corriger le style et le formatage | `pnpm check` |
| Vérifier seulement, sans corriger | `pnpm lint` |
| Vérifier les types | `pnpm typecheck` |
| Lancer les tests | `pnpm test` |
| …en continu pendant qu'on code | `pnpm test:watch` |
| …avec la couverture | `pnpm coverage` |
| Créer une migration après avoir changé le schéma | `pnpm db:generate` |
| Appliquer les migrations | `docker compose run --rm migrate` |
| Explorer la base dans le navigateur | `pnpm db:studio` |
| **Tout vérifier avant de pousser** | `pnpm verify` |

Les tests ont besoin de la base `db-test`, que `docker compose up` démarre
avec le reste. Elle vit en mémoire et ne conserve rien.

### Faire tourner plusieurs copies du dépôt

```bash
URL_PORT=8081 ./setup && docker compose up -d --wait
```

Tous les ports publiés dérivent de `URL_PORT` : le tableau de bord Traefik
(`18081`) et la base de test (`15433`) suivent. Chaque copie a son propre
Traefik, qui ne voit que ses propres conteneurs.

---

## Où se trouve quoi

```
app/                    ce qui est envoyé au navigateur
  pages/                UNE PAGE = UN FICHIER. pages/a-propos.vue → /a-propos
  components/           auto-importés : pas d'import à écrire
  composables/          fonctions réutilisables (useXxx)
  layouts/default.vue   l'entête et le pied de page communs
  assets/css/base.css   TOUT le design du site
server/                 ce qui tourne sur le serveur, jamais envoyé au client
  api/                  UNE ROUTE = UN FICHIER. api/health.get.ts → GET /api/health
  database/schema/      les tables, source de vérité du modèle de données
  plugins/              exécutés au démarrage (dont la validation de la config)
shared/                 partagé entre les deux, importé par #shared/...
drizzle/                migrations SQL générées, relues à la main et versionnées
deploy/                 docker-compose et configuration Traefik
scripts/seed/           contenu de la maquette, à passer en base au lot 3
test/                   unit (rapide) · nuxt (composants) · api (vraie base)
docs/                   PLAN.md (le chantier) · OUTILS.md (la pile)
setup                   génère le docker-compose.yml de la racine
```

Trois fichiers de la racine sont **générés** et gitignorés :
`docker-compose.yml`, `.setup-state` et `deploy/config/traefik-dev.yml`.
Ne pas les modifier à la main — relancer `./setup`.

---

## Conventions

**Les messages de commit** suivent [Conventional
Commits](https://www.conventionalcommits.org/fr/), et un hook les refuse
sinon. Préfixes admis : `feat`, `fix`, `docs`, `style`, `refactor`, `perf`,
`test`, `build`, `ci`, `chore`, `revert`. Un `!` signale une rupture
(`chore!: …`).

**Les vérifications tournent avant chaque commit.** À installer une fois :

```bash
uv tool install pre-commit     # ou : pipx install pre-commit
pre-commit install --install-hooks -t pre-commit -t commit-msg
```

C'est le seul outil Python qui subsiste, et c'est délibéré : le hook qui
compte le plus est `detect-secrets`, avec une liste de faux positifs déjà
auditée, et il est écrit en Python. Changer d'ordonnanceur pour retirer
Python tout en gardant un hook Python n'enlèverait rien.

**Le développement se fait en TDD** : le test d'abord, rouge, puis le code.

**Aucun secret dans le dépôt.** `./setup` génère les secrets de
développement dans `.env.dev`, qui est gitignoré. Le dépôt étant public,
une clé poussée serait compromise immédiatement et irréversiblement — les
forks et les caches GitHub la conservent malgré toute réécriture
d'historique.
