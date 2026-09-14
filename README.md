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
| Le site | <http://unmaxdinfo.localhost:8000> |
| La sonde | <http://unmaxdinfo.localhost:8000/api/health> |
| Le tableau de bord Traefik | <http://localhost:18000> |

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
| …en surveillant les dépendances | `docker compose watch` |
| Voir les journaux | `docker compose logs -f app` |
| Savoir sur quoi ce dossier est réglé | `./setup --show` |
| Changer de port | poser `URL_PORT` dans `.env.dev`, puis `./setup` |
| Corriger le style et le formatage | `pnpm check` |
| Vérifier seulement, sans corriger | `pnpm lint` |
| Vérifier les types | `pnpm typecheck` |
| Lancer les tests | `pnpm test` |
| …en continu pendant qu'on code | `pnpm test:watch` |
| …avec la couverture | `pnpm coverage` |
| Créer une migration après avoir changé le schéma | `pnpm db:generate` |
| Appliquer les migrations | `docker compose run --rm migrate` |
| Explorer la base dans le navigateur | `pnpm db:studio` |
| Semer le contenu d'origine | `docker compose run --rm --entrypoint sh migrate -c 'node_modules/.bin/tsx scripts/seed/seed.ts'` |
| **Tout vérifier avant de pousser** | `pnpm verify` |

Les tests ont besoin de la base `db-test`, que `docker compose up` démarre
avec le reste. Elle vit en mémoire et ne conserve rien.

### Après un `pnpm add`

Le `node_modules` vit **dans l'image**. Ajouter une dépendance ne suffit donc
pas : l'image garde l'ancienne et l'application échoue sur un module
introuvable, avec un message qui ne dit pas pourquoi.

```bash
docker compose up -d --build    # reconstruit puis redémarre
```

Ou, mieux, laisser tourner `docker compose watch` : il reconstruit tout seul
dès que `package.json` ou `pnpm-lock.yaml` changent. Contrepartie : la
commande occupe le terminal.

### Travailler en HTTPS

Par défaut le site est servi en clair. Pour passer en HTTPS, poser dans
`.env.dev` :

```
URL_SCHEME=https
NUXT_PUBLIC_BASE_URL=https://unmaxdinfo.localhost:8000
```

puis `./setup && docker compose up -d --force-recreate rp app`.

**Pourquoi s'en soucier en développement** : un navigateur refuse les cookies
`Secure` en clair, `SameSite` ne se comporte pas pareil, et Google exige des
URI de redirection HTTPS. Déboguer l'authentification *et* le protocole en
même temps est le meilleur moyen de ne comprendre ni l'un ni l'autre.

`./setup` génère le certificat. Avec **mkcert** installé, il produit un
certificat que le navigateur accepte — à condition d'avoir fait une fois :

```bash
mkcert -install     # ajoute l'autorité au magasin du système
```

Sans mkcert, il produit un certificat auto-signé : la plomberie fonctionne,
mais le navigateur affiche un avertissement. Pour basculer ensuite, supprimer
`deploy/certs/` et relancer `./setup`.

### Faire tourner plusieurs copies du dépôt

```bash
URL_PORT=8001 ./setup && docker compose up -d --wait
```

Le projet occupe le **8000** et non le 8080, laissé aux projets du travail.
Tous les ports publiés en dérivent par un décalage fixe — tableau de bord
`+10000`, base de test `+7000` : le tableau de bord Traefik
(`18001`) et la base de test (`15001`) suivent. Chaque copie a son propre
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

## Déploiement

Un `push` sur `main` déclenche `deploy.yml`, qui **attend que la CI soit
verte**, publie les images sur GHCR, rend le compose de production et le
copie sur le VPS. Puis, dans cet ordre :

```bash
docker compose pull
docker compose run --rm migrate   # si ceci échoue…
docker compose up -d --wait       # …ceci ne s'exécute pas
```

C'est toute la garantie : une migration en échec ne bascule rien, et
l'ancienne image continue de servir. Les migrations doivent donc rester
**compatibles vers l'arrière** le temps de la bascule — ajouter une colonne,
jamais la renommer d'un coup.

Secrets GitHub attendus : `DEPLOY_HOST`, `DEPLOY_USER`, `DEPLOY_SSH_KEY`,
`DEPLOY_PATH`. Le fichier `.env` vit **sur le serveur**, jamais dans le
dépôt ni dans la CI.

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
