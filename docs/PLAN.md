# unmaxdinfo.fr — passage de la maquette à la production

> ## ⚠ Mise à jour du 14 septembre 2026 — la pile a changé
>
> Ce plan a été rédigé et approuvé pour un backend **Python / FastAPI**. Le projet
> a depuis basculé sur une pile **tout-TypeScript, en Nuxt 4 full-stack**.
>
> **Ce qui reste entièrement valable** : le contexte, le modèle de données, les
> contraintes des API tierces, le découpage du back-office, l'export/import, la
> stratégie de test, le découpage en lots et la procédure de vérification.
>
> **Ce qui est caduc** : tous les noms d'outils Python, et surtout la section
> « Référencement sans migration Nuxt » — le module `app/render/` n'existe plus,
> le rendu serveur de Nuxt le remplace nativement. C'est précisément le motif de
> la bascule. Le dépôt est par ailleurs **public**, et non privé.
>
> La table de correspondance entre les deux piles est dans
> **[`OUTILS.md`](OUTILS.md#correspondance-avec-lancienne-pile)**.


## Context

Le dossier `~/Documents/perso/max_infos` contient aujourd'hui une **maquette Vue 3 + Vite
entièrement statique** : le contenu vit en dur dans `frontend/src/data/*.js` et
`frontend/src/content/*.md`, il n'y a ni base de données, ni API, ni Docker, ni dépôt git.

Deux personnes, deux besoins opposés :

- **Max** (Maximilien Huet) est le journaliste et le futur propriétaire du site. Il écrit les
  articles longs, publie lui-même ses reels Instagram et ses posts LinkedIn. Il doit pouvoir
  tout gérer et tout personnaliser **sans jamais voir un champ technique**.
- **JB** est le développeur. Il gère l'infrastructure, les comptes tiers et les clés. Il ne
  touche pas au contenu.

Objectif de ce chantier : transformer la maquette en site de production déployable sur un VPS
derrière un Traefik existant, avec une base PostgreSQL, une API FastAPI, un back-office à deux
rôles, la découverte automatique des publications Instagram, et un export complet permettant de
déménager le site ou de repartir d'une base vierge.

À terme les articles ne vivront plus que sur ce site ; Substack reste un canal newsletter
alimenté par copier-coller assisté.

---

## Décisions arrêtées

| Sujet | Choix |
|---|---|
| Backend | ~~FastAPI + SQLAlchemy 2 + Alembic~~ → **Nuxt 4 (Nitro) + Drizzle ORM, TypeScript**, dépendances avec `pnpm` |
| Base | PostgreSQL 17 |
| Front | ~~Vue 3 + Vite, aucune migration Nuxt~~ → **Nuxt 4**, qui reprend le Vue existant converti en TypeScript |
| Référencement | ~~Injection manuelle dans index.html~~ → **rendu serveur natif de Nuxt** |
| Médias | **Cloudflare R2** (S3, via `boto3`), servis sur `media.unmaxdinfo.fr` |
| Domaine | `unmaxdinfo.fr`, registrar Infomaniak |
| Auth | OAuth2 Google, liste blanche + rôles en base (`tech`, `editor`) |
| Instagram | Compte Créateur (déjà converti) + app Meta, **lecture seule** (`instagram_business_basic`) |
| LinkedIn | **Aucune API** — URL collée à la main, rendu par l'embed officiel |
| Publication | **Le site ne publie jamais.** Il découvre, affiche, et aide à la rédaction |
| Substack | Import one-shot du flux RSS existant, puis copie assistée |
| Dépôt / CI | GitHub **public** + Actions + GHCR, déploiement SSH du compose rendu |
| Traefik | **Déjà en place sur le serveur** — le projet rejoint son réseau externe |

## Contraintes techniques vérifiées (à ne pas réapprendre)

1. **Instagram Basic Display est mort** (fin 2024). La seule voie est l'**Instagram API with
   Instagram Login**, qui ne nécessite **pas** de Page Facebook depuis juillet 2024.
   Permission `instagram_business_basic`. Token 60 jours, rafraîchissable tant qu'il est
   utilisé dans la période.
2. **Pas d'App Review nécessaire** : Max est le seul compte connecté, l'app Meta peut rester
   en mode développement avec son compte déclaré testeur.
3. **La découverte automatique LinkedIn est impossible.** Le scope `r_member_social` est fermé
   aux nouvelles applications (« not accepting access requests at this time »). Toute
   publication LinkedIn sera saisie manuellement.
4. **Substack n'a pas d'API de publication.** Les solutions existantes reposent sur le cookie
   de session `substack.sid` — non supporté, écarté.
5. Les **embeds Instagram sont servis en thème clair** et cela ne se change pas. C'est
   précisément pour cela qu'on passe à des cartes maison alimentées par l'API.

---

## Architecture

**Trois conteneurs**, un réseau applicatif interne, plus le réseau `reverse_proxy` externe.

```
unmaxdinfo.fr ──▶ Traefik (existant) ──▶ api      FastAPI : API JSON + HTML + assets Vue
                                          ├──▶ db     PostgreSQL 17 (volume nommé)
                                          └──▶ R2     images + PDF, via boto3
media.unmaxdinfo.fr ─────────────────────────▶ Cloudflare R2 (hors Docker)
                     worker  APScheduler : sync Instagram, refresh token, sauvegardes
```

**Pourquoi l'API sert aussi le front** : l'injection des balises `<title>`, Open Graph et du
corps de l'article doit se faire au moment de la requête, ce que nginx ne sait pas faire
proprement. Un `Dockerfile` multi-étapes construit le front avec Node puis copie `dist/` dans
l'image Python. Conséquence assumée : front et back sont versionnés et déployés ensemble —
souhaitable pour un projet à deux personnes.

### Arborescence cible

```
max_infos/
├── backend/
│   ├── app/
│   │   ├── main.py                 # création de l'app, montage des routeurs
│   │   ├── core/                   # config.py, db.py, security.py, storage.py, crypto.py
│   │   ├── models/                 # SQLAlchemy 2 (Mapped[...], DeclarativeBase)
│   │   ├── schemas/                # Pydantic v2
│   │   ├── routers/public/         # articles, social, site, feeds, views
│   │   ├── routers/admin/          # articles, media, social, settings, users, system
│   │   ├── routers/auth.py         # OAuth2 Google
│   │   ├── services/               # instagram.py, seo.py, export.py, markdown.py, substack.py
│   │   ├── render/                 # injection SEO dans index.html
│   │   └── workers/scheduler.py
│   ├── migrations/                 # Alembic
│   ├── tests/                      # pytest + httpx + base éphémère
│   ├── pyproject.toml              # uv
│   └── deploy/Dockerfile           # node build → python runtime
├── frontend/                       # existant, à brancher sur l'API
├── deploy/
│   ├── docker-compose.yml                    # base, façonnée prod
│   ├── docker-compose-dev-override.yml       # build local, montages, vite, Traefik local
│   ├── docker-compose-prod-override.yml      # réseau reverse_proxy externe
│   └── config/traefik-dev.yml.tpl            # config statique du Traefik de dev
├── setup                           # génère le docker-compose.yml racine
├── .github/workflows/{ci.yml,deploy.yml}
├── .env.example
└── README.md
```

---

## Modèle de données

| Table | Colonnes principales |
|---|---|
| `article` | `id`, `slug` (unique), `title`, `dek`, `body_md`, `status` (`draft`/`published`), `published_at`, `cover_media_id`, `reading_minutes`, `char_count`, `featured`, `position`, `seo_title`, `seo_description`, `substack_url`, `source` (`site`/`substack_import`), timestamps |
| `tag` | `id`, `slug`, `label`, `color` |
| `article_tag` | association |
| `media` | `id`, `r2_key`, `url`, `mime`, `width`, `height`, `bytes`, `alt`, `kind` (`image`/`pdf`), `uploaded_by`, `created_at` |
| `social_post` | `id`, `network` (`instagram`/`linkedin`), `external_id`, `url`, `shortcode`, `media_type` (`reel`/`carousel`/`image`/`post`), `caption`, `thumbnail_url`, `permalink`, `posted_at`, `source` (`api`/`manual`), `hidden`, `position`, `raw` (JSONB) |
| `article_social_post` | `article_id`, `social_post_id`, `position` — **facultatif des deux côtés** |
| `setting` | `key` (PK), `value` (JSONB), `scope` (`public`/`tech`), `updated_by`, `updated_at` |
| `secret` | `key` (PK), `ciphertext`, `updated_at` — chiffré Fernet, clé en variable d'environnement |
| `app_user` | `id`, `email` (unique), `name`, `avatar_url`, `role` (`tech`/`editor`), `active`, `last_login_at` |
| `article_view` | `article_id`, `day`, `count` — agrégat quotidien, aucun cookie, aucune IP stockée |

Règles :
- Un article peut n'avoir **aucune** déclinaison sociale ; un post social peut exister **sans**
  article. La jonction est une table à part, jamais une clé étrangère sur `article`.
- `secret` ne contient que les jetons tiers (Meta). Les clés d'infrastructure (R2, base,
  Google) restent en variables d'environnement — elles sont nécessaires au démarrage.
- Tout ce qui est éditable par Max vit dans `setting`, en JSON, donc entièrement exportable.

### Contenu de `setting`

| Clé | Portée | Contenu |
|---|---|---|
| `identity` | public | nom du site, auteur, signature, accroche, pitch |
| `contact` | public | e-mail, téléphone, ville, liens sociaux — **chaque champ avec son propre interrupteur de visibilité** |
| `cv` | public | le CV entier en données structurées (voir ci-dessous) + PDF téléversé |
| `home` | public | ordre, visibilité et titres des sections de l'accueil, articles à la une |
| `theme` | public | palette (les variables CSS de `base.css`), typographie |
| `seo` | public | titre et description par défaut, image de partage |
| `templates` | public | gabarits de déclinaison LinkedIn et script de reel |
| `instagram` | tech | identifiant du compte, cadence de synchronisation, dernière sync |
| `storage` | tech | bucket, domaine public R2 |

### Le CV en données

Le CV actuel de Max (`CV Maximilien Huet.pdf`) sert de modèle. Il est repris **rubrique par
rubrique en JSON** dans `setting.cv`, ce qui permet à la page À propos d'être une vraie page web
— responsive, indexable, thème sombre — plutôt qu'un PDF encastré :

```jsonc
{
  "headline": "Étudiant en histoire",
  "birthdate": "2004-02-06",          // visible: false par défaut
  "photo_media_id": 12,
  "intro": "Diplômé d'un master de recherche historique…",
  "education":   [{ "title": "Master de recherche histoire", "org": "Université de Rennes II",
                    "detail": "Reçu mention très bien", "start": "2024", "end": "2026" }],
  "experience":  [{ "title": "Conducteur de manège", "org": "Le Grand Huit — Rennes",
                    "start": "2025-09", "end": "2026-05" }],
  "engagements": [{ "title": "Un Max d'Info", "role": "Rédaction",
                    "org": "Projet journalistique — Substack", "start": "2026", "end": "2027",
                    "url": "https://unmaxdinfo.substack.com/" }],
  "skills":    ["Analyse critique de l'information", "…"],
  "interests": ["Presse politique, sportive et internationale", "…"],
  "languages": [{ "label": "Français", "level": null },
                { "label": "Anglais",  "level": "B2" }],
  "certifications": ["Permis B", "PSC1"]
}
```

Chaque rubrique et chaque entrée porte un champ `visible`, réordonnable par glisser-déposer dans
l'admin. Les rubriques vides ne s'affichent pas.

**Confidentialité** — le CV comporte des données personnelles qui n'ont rien à faire sur une page
publique indexée. Réglage d'origine : **téléphone, adresse postale et date de naissance masqués**,
e-mail affiché obfusqué (rendu côté serveur en entités, jamais en clair dans le HTML source).
L'admin affiche explicitement l'avertissement au moment de rendre l'un de ces champs visible.

**Le PDF** reste téléversable en parallèle (bouton « Télécharger le CV »), stocké dans R2 comme
un `media` de type `pdf`. Les deux coexistent : la version web pour le référencement et la
lecture, le PDF pour les candidatures.

---

## API

**Publique** (sans authentification)

```
GET  /api/articles?tag=&q=&page=      liste paginée, articles publiés
GET  /api/articles/{slug}             article + tags + déclinaisons liées
GET  /api/tags
GET  /api/social-posts?network=       publications, filtrables
GET  /api/site                        tous les settings de portée « public »
POST /api/articles/{slug}/view        incrément anonyme, anti-rebond en mémoire
GET  /rss.xml  /sitemap.xml  /robots.txt
```

**Authentification**

```
GET  /api/auth/google/login           redirection OAuth2
GET  /api/auth/google/callback        vérifie la liste blanche, ouvre la session
GET  /api/auth/me                     utilisateur courant + rôle
POST /api/auth/logout
```

Session par **cookie `httpOnly`, `Secure`, `SameSite=Lax`** signé — pas de JWT en
`localStorage`. Protection CSRF sur les méthodes d'écriture.

**Admin** — `/api/admin/*`, toutes les routes derrière une dépendance de rôle.

| Route | Rôle requis |
|---|---|
| `articles`, `media`, `social-posts`, `tags`, `settings` (portée publique) | `editor` |
| `instagram/sync`, `instagram/connect`, `settings` (portée technique), `users`, `export`, `import`, `logs` | `tech` |

Le front interroge `/api/auth/me` et **masque entièrement** les sections techniques pour Max —
la restriction n'est pas qu'un refus serveur, c'est une absence dans le menu.

---

## ~~Référencement sans migration Nuxt~~ — CADUC

> Toute cette section est sans objet depuis la bascule : le rendu serveur de Nuxt
> fait nativement ce que ce module devait fabriquer à la main. Conservée pour
> mémoire, parce qu'elle explique *pourquoi* la bascule a eu lieu.

`app/render/` intercepte les requêtes HTML (`Accept: text/html`) sur `/`, `/article/{slug}`,
`/publication/{id}`, `/a-propos`. Il lit `frontend/dist/index.html` une fois au démarrage, puis
pour chaque requête injecte :

- `<title>`, `<meta name="description">`, `<link rel="canonical">`
- Open Graph complet + Twitter Card (image de couverture servie depuis R2)
- JSON-LD `Article` / `Person`
- **le corps de l'article déjà rendu en HTML** dans le conteneur d'hydratation

Vue reprend la main au chargement. Les partages LinkedIn, WhatsApp et Slack affichent un aperçu
correct — leurs robots n'exécutent pas de JavaScript, c'est le vrai gain. Google indexe le texte
sans attendre son second passage de rendu.

Le rendu Markdown se fait **côté serveur** (`markdown-it-py` + `bleach`), ce qui permet au
passage de supprimer le moteur Markdown maison de `frontend/src/lib/markdown.js` : une seule
implémentation, celle qui fait autorité.

---

## Intégration Instagram

**Connexion** (une fois, par JB) : écran technique de l'admin → bouton « Connecter Instagram »
→ OAuth Meta → le token long est chiffré dans `secret`.

**Synchronisation** : le worker appelle `GET /me/media` toutes les heures et
`GET /me` pour le profil. Chaque média absent en base crée un `social_post` avec
`source='api'`, `hidden=false`, non rattaché. L'admin affiche un compteur
« N nouvelles publications » ; Max les relie à un article, les masque, ou les laisse libres.

**Profil** : nom, `@`, biographie, photo et nombre d'abonnés sont stockés dans `setting`
(`instagram.profile`) à chaque sync. **Fin des valeurs inventées de la maquette.**

**Rafraîchissement du token** : tâche quotidienne. Si le token approche de l'expiration sans
avoir pu être rafraîchi, l'admin affiche une alerte visible uniquement par JB.

**Rendu** : on abandonne les iframes officielles au profit de **cartes maison** dessinées avec
le CSS du site — vignette, type (reel / carrousel), légende tronquée, date, lien vers
Instagram. C'est ce qui règle le problème des blocs blancs dans le thème sombre.

---

## Back-office

Écrans, dans l'ordre du menu :

1. **Tableau de bord** — brouillons, publications non rattachées, vues de la semaine, alertes.
2. **Articles** — liste filtrable ; éditeur en deux colonnes (Markdown / aperçu réel), champs
   chapô, tags, couverture, SEO, programmation de publication. Sauvegarde automatique.
3. **Décliner** — panneau attaché à un article publié : squelette de post LinkedIn et script de
   reel pré-remplis depuis `settings.templates`, variables résolues, bouton *copier*. Champ pour
   coller en retour l'URL LinkedIn ou Instagram, qui crée le `social_post` et le lien.
4. **Publications** — grille des posts Instagram découverts et LinkedIn saisis : rattacher,
   masquer, réordonner.
5. **Page d'accueil** — ordre et visibilité des sections, articles à la une.
6. **À propos / CV** — éditeur rubrique par rubrique du CV structuré (intro, formations,
   expériences, engagements, compétences, centres d'intérêt, langues, certifications), chaque
   entrée réordonnable et masquable ; photo et PDF téléversés ; bloc **contact** avec
   interrupteur de visibilité par champ et avertissement sur les données personnelles.
7. **Apparence** — palette et typographie, prévisualisées en direct.
8. **Technique** *(JB uniquement)* — connexions tierces, stockage, utilisateurs, export/import,
   journal de synchronisation.

---

## Export / import

`GET /api/admin/export` produit une **archive ZIP** :

```
export-2026-09-12/
├── manifest.json          version du schéma, date, comptages
├── articles/<slug>.md     front-matter YAML + corps Markdown
├── data/{tags,social_posts,links,settings,users,views}.json
└── media/manifest.json    clés R2, URL, dimensions, textes alternatifs
```

Les fichiers eux-mêmes restent dans R2 (c'est tout l'intérêt de l'externaliser) : l'archive ne
transporte que les références. Réimporter dans une base vierge restaure un site identique.
`secret` n'est **jamais** exporté.

Import par commande (`python -m app.cli import archive.zip`) et par téléversement dans l'écran
technique, avec mode `--dry-run` qui affiche le différentiel avant d'écrire.

**Migration initiale** : un script one-shot lit `frontend/src/data/*.js`, les Markdown de
`frontend/src/content/`, le flux RSS Substack pour récupérer les couvertures, et **le CV PDF
existant transcrit en `setting.cv`** (formations, expériences, engagements, compétences, langues,
centres d'intérêt), puis écrit tout en base. Les fichiers de données du front sont ensuite
supprimés.

---

## Docker, Traefik, CI

**`./setup [env_file]`**, repris de `~/monorepo/1` et allégé :

1. `source` le fichier d'environnement choisi (défaut `.env.dev`), crée un gabarit s'il manque
2. calcule `INSTANCE_NAME` (utilisateur + dossier) pour permettre plusieurs clones côte à côte
3. `docker compose -p "$INSTANCE_NAME" --project-directory . -f deploy/docker-compose.yml -f deploy/docker-compose-<env>-override.yml config > docker-compose.yml`
4. `sed` de re-relativisation des chemins absolus
5. affiche un récapitulatif (URL, base, ports)

Le `docker-compose.yml` racine est **gitignoré** — c'est un artefact, comme au travail.

**Traefik en production** : le compose de prod rejoint `networks: reverse_proxy: external: true`
et ne pose que ses labels, suffixés par `${INSTANCE_NAME}`. **Aucune modification de ton Traefik
existant, aucun conteneur Traefik déployé par ce projet.**

### Traefik en développement local

La stack de dev embarque **son propre Traefik jetable**, pour que le routage local soit
identique au routage de production — mêmes labels, mêmes préfixes, mêmes en-têtes. Aucune
surprise au premier déploiement.

```
                             ┌──▶ front   vite dev, HMR, montage du source
127.0.0.1:${URL_PORT} ──▶ rp ─┼──▶ api     uvicorn --reload, montage du source
    (Traefik local)          │
127.0.0.1:${DASHBOARD_PORT} ─┘    tableau de bord Traefik
                                  db      PostgreSQL, volume nommé
```

Points de conception :

- **Noms d'hôte en `.localhost`** — `unmaxdinfo.localhost` résout vers `127.0.0.1` nativement
  dans Chrome et Firefox : **rien à écrire dans `/etc/hosts`**.
- **Ports liés à `127.0.0.1` uniquement**, jamais `0.0.0.0` — la stack de dev n'est pas exposée
  au réseau local. `URL_PORT` par défaut `8080`, `DASHBOARD_PORT` dérivé (`18080`), comme dans
  ton `./setup` au travail. Le script fait le même contrôle de port avant de démarrer et
  propose un port libre si le tien est déjà pris.
- **Isolation entre projets** — le Traefik de dev est configuré avec
  `providers.docker.constraints: Label("com.docker.compose.project", "${INSTANCE_NAME}")` et
  `exposedByDefault: false`. Sans cette contrainte, il ramasserait les conteneurs de tes autres
  projets via la socket Docker, tous porteurs de règles `Host(localhost)` concurrentes. La
  socket est montée en lecture seule.
- **Routage identique à la prod** : `PathPrefix("/api")` vers `api` avec une priorité
  supérieure, tout le reste vers `front`. En dev, `front` est le serveur Vite (avec le
  WebSocket de rechargement à chaud passé par Traefik) ; en prod, c'est le conteneur `api` qui
  sert `dist/` et injecte les balises.
- **Un profil `preview`** permet de faire servir le vrai build par l'`api` derrière le même
  Traefik, pour vérifier l'injection SEO et le rendu de production **sans déployer**. C'est le
  seul moyen de tester le point 9 de la vérification en local.
- Le tableau de bord Traefik est activé en dev (`api.insecure: true`, uniquement sur la boucle
  locale) — pratique pour voir pourquoi une règle ne s'applique pas.

`./setup` génère la configuration statique par `envsubst < deploy/config/traefik-dev.yml.tpl`,
comme au travail.

Démarrage :

```bash
./setup              # réutilise la dernière configuration, ou crée .env.dev
docker compose up -d --wait
# → http://unmaxdinfo.localhost:8080        le site
# → http://unmaxdinfo.localhost:8080/api/docs   la doc OpenAPI
# → http://localhost:18080                  le tableau de bord Traefik
```

**GitHub Actions** :
- `ci.yml` sur chaque *push* et chaque *pull request* — voir la section « Qualité de code »
  ci-dessous pour le détail des tâches.
- `deploy.yml` sur `main` et sur tag — build multi-étapes, push sur `ghcr.io/<user>/unmaxdinfo`,
  génération du compose de prod, `scp` vers le serveur, `docker compose up -d --wait`, migrations
  Alembic dans un conteneur éphémère avant le basculement. Le déploiement est **conditionné à la
  réussite de `ci.yml`**.

---

## Qualité de code

### Outillage

| Domaine | Outil | Réglage |
|---|---|---|
| Dépendances Python | **uv** | `pyproject.toml` + `uv.lock` versionné, Python 3.12 épinglé `>=3.12,<3.13` |
| Formatage / lint Python | **ruff** (format + lint) | ligne 120, règles `E,F,I,N,UP,B,SIM,RUF,ASYNC,S` (`S` = bandit) |
| Typage | **mypy** | `strict = true` sur `app/`, plus permissif sur `tests/` |
| Tests Python | **pytest** + `pytest-asyncio` + `httpx.AsyncClient` + `factory-boy` | `--cov=app --cov-fail-under=80` |
| Lint front | **ESLint** (`eslint-plugin-vue`) + **Prettier** | absents de la maquette, à installer |
| Tests front | **Vitest** + `@vue/test-utils` | composants et composables |
| Migrations | **Alembic** | un test vérifie qu'il n'y a **aucune migration manquante** (`--autogenerate --check`) |
| Sécurité | **pip-audit**, **npm audit**, **Trivy** sur l'image | échec sur les vulnérabilités *high* et *critical* |
| Messages de commit | **commitlint** + **Conventional Commits** | via un hook `commit-msg` |

### `pre-commit`

Fichier `.pre-commit-config.yaml` à la racine, installé par `uv run pre-commit install
--install-hooks -t pre-commit -t commit-msg`. Hooks :

- hygiène générale : `trailing-whitespace`, `end-of-file-fixer`, `check-yaml`,
  `check-merge-conflict`, `check-added-large-files`
- **`detect-secrets`** avec une `.secrets.baseline` versionnée — le filet de sécurité qui compte,
  vu l'exigence « aucun secret en clair »
- `ruff` puis `ruff-format` sur `backend/`
- `mypy` sur `backend/app/`
- `eslint --fix` et `prettier --write` sur `frontend/src/`
- `commitlint` sur le message

En CI, la même passe tourne en mode différentiel, comme au travail :
`uv run pre-commit run --from-ref origin/main --to-ref HEAD`. Un développeur qui a sauté les
hooks en local voit l'échec au plus tard sur sa *pull request*.

### Stratégie de test

Le développement se fait **en TDD** : le test d'abord, rouge, puis le code.

| Niveau | Ce qui est couvert |
|---|---|
| **Unitaires** | rendu Markdown et nettoyage HTML, calcul du temps de lecture, génération de slug, résolution des variables de gabarit, chiffrement `secret`, injection des balises SEO, sérialisation export/import |
| **Intégration API** | chaque route, en base PostgreSQL réelle et éphémère (conteneur dédié en CI), transaction annulée entre chaque test |
| **Autorisations** | tableau paramétré (route × rôle × code attendu). Un test explicite vérifie que le rôle `editor` reçoit `403` sur **toutes** les routes techniques — le non-respect de cette règle est le pire risque du projet |
| **Instagram** | client HTTP simulé (`respx`), avec des réponses réelles anonymisées : premier appel, pagination, publication déjà connue, token expiré, quota atteint |
| **Export / import** | test aller-retour : exporter, vider la base, réimporter, comparer les données terme à terme |
| **Front** | composants de rendu (carte d'article, carte de publication, rendu du CV), composables, garde de route de l'admin |

Aucun appel réseau réel dans les tests : Meta, Google et R2 sont simulés. Les tests tournent sans
connexion Internet.

### Ce que fait `ci.yml`

Tâches parallèles, toutes bloquantes :

1. **`quality`** — `uv sync --frozen`, `pre-commit run` en différentiel, `ruff check`, `mypy`
2. **`test-backend`** — service PostgreSQL, `alembic upgrade head`, contrôle des migrations
   manquantes, `pytest --cov --cov-fail-under=80`, rapport de couverture en résumé de la tâche
3. **`test-frontend`** — `npm ci`, `eslint`, `vitest run --coverage`, `npm run build`
4. **`security`** — `pip-audit`, `npm audit --audit-level=high`, `trivy image` sur l'image
   construite
5. **`build`** — build de l'image multi-étapes, **sans publication** hors de `main`

Cache `uv` et `npm` activé. `uv.lock` et `package-lock.json` sont versionnés et la CI utilise
`--frozen` / `npm ci` : une CI qui passe garantit des versions identiques à la prod.

---

**Secrets** : `.env` sur le serveur (jamais dans le dépôt) et secrets GitHub pour la CI. Pas
d'`envcoder` — inutile à deux personnes sur un seul serveur. `.env.example` documente chaque
variable. `.gitignore` couvre `.env*`, `docker-compose.yml`, `node_modules`, `dist`,
`.venv`, `*.pem`.

---

## Frontend : ce qui change

Le CSS (`frontend/src/assets/base.css`) et la structure des vues sont **conservés**. Les
modifications :

- `src/data/*.js` disparaissent, remplacés par `src/api/client.js` et des composables
  (`useArticles`, `useSocialPosts`, `useSite`).
- Les réglages publics sont chargés une fois et injectés en variables CSS — c'est ce qui rend la
  palette modifiable depuis l'admin.
- `InstagramEmbed.vue` et `InstagramConnect.vue` sont remplacés par une carte maison alimentée
  par l'API. **La grille est retravaillée** (point signalé comme insatisfaisant), en séparant
  nettement le rythme des articles longs de celui des publications courtes.
- `AdminView.vue` (aujourd'hui une maquette non fonctionnelle) devient le vrai back-office, sous
  `/admin`, avec garde de route sur `/api/auth/me`.
- La skill `frontend-design` sera invoquée au moment de retravailler la grille Instagram et le
  back-office.

---

## Découpage en lots

| Lot | Contenu | Résultat observable |
|---|---|---|
| 1 | Git, structure du dépôt, `.gitignore`, `.env.example`, README, **outillage qualité** (uv, ruff, mypy, pytest, ESLint, Vitest, pre-commit, commitlint) et `ci.yml` | `pre-commit run --all-files` passe sur un dépôt vide, la CI est verte dès le premier commit |
| 2 | FastAPI + Postgres + Alembic + modèles + `./setup` + **Traefik de dev** | `docker compose up -d --wait`, `http://unmaxdinfo.localhost:8080/api/health` répond |
| 3 | API publique en lecture + migration du contenu existant | Le Vue actuel affiche les données de la base |
| 4 | OAuth Google, rôles, sessions | JB et Max se connectent, Max ne voit pas l'écran technique |
| 5 | Admin : articles, médias (R2), tags | Max écrit et publie un article depuis le navigateur |
| 6 | Intégration Instagram : connexion, sync, profil, cartes maison | Les vraies publications et le vrai profil s'affichent |
| 7 | Rattachement article ↔ publications, LinkedIn manuel, gabarits de déclinaison | Max relie un reel à un article et copie son post LinkedIn |
| 8 | Réglages : accueil, CV structuré, contact, apparence | Max change la home, son CV et la palette sans coder |
| 9 | SEO : injection serveur, RSS, sitemap, Open Graph, compteur de vues | Aperçu de partage correct, flux valide |
| 10 | Export/import + sauvegarde | Archive téléchargée, réimportée dans une base vierge |
| 11 | CI, compose de prod, déploiement, HTTPS | `https://unmaxdinfo.fr` en ligne |

Chaque lot est développé en TDD (pytest côté API, Vitest côté front) et donne lieu à un commit
conventionnel.

---

## Vérification

**Local**

1. `./setup .env.dev && docker compose up -d --wait` — tous les conteneurs sont `healthy`.
2. `curl http://unmaxdinfo.localhost:8080/api/health` puis `/api/articles` — les 5 articles
   migrés répondent **à travers le Traefik local**, pas via un port publié en direct.
   Le tableau de bord `http://localhost:18080` liste les deux routeurs et aucun conteneur
   d'un autre projet.
3. `cd backend && uv run pytest --cov` — couverture ≥ 80 %, et le test paramétré
   d'autorisations couvre **toutes** les routes techniques.
4. `cd frontend && npm run lint && npm run test && npm run build`.
5. `uv run pre-commit run --all-files` — tout passe, y compris `detect-secrets`.
6. Connexion Google avec le compte de Max → l'écran « Technique » est **absent du menu** ;
   `curl` direct sur `/api/admin/settings?scope=tech` avec sa session → `403`.
7. Écrire un article dans l'admin, téléverser une image → elle apparaît sur `media.unmaxdinfo.fr`.
8. Cliquer « Synchroniser Instagram » → les publications réelles et le vrai nombre d'abonnés
   apparaissent.
9. Coller une URL de post LinkedIn → il apparaît et se rattache à un article.
10. Profil `preview` (`./setup .env.preview`) puis
    `curl -H 'Accept: text/html' http://unmaxdinfo.localhost:8080/article/<slug> | grep 'og:title'`
    → les balises sont présentes **dans la réponse HTTP**, pas seulement après exécution du
    JavaScript.
11. Exporter, supprimer le volume Postgres, remonter, réimporter → site identique.
12. Fenêtre à 375 px : aucun débordement horizontal.
13. `curl -s http://unmaxdinfo.localhost:8080/a-propos | grep -E '07\.77|rue de Redon|06\.02\.2004'`
    → **aucun résultat** : les données personnelles ne fuitent pas dans le HTML servi.

**Production**

14. La CI est verte sur `main`, puis le déploiement passe ; `https://unmaxdinfo.fr` répond en
    HTTPS via le Traefik existant, sans que les autres sites du serveur soient affectés.
15. Coller l'URL d'un article dans LinkedIn → l'aperçu affiche titre, description et couverture.
16. `https://unmaxdinfo.fr/rss.xml` valide sur le validateur W3C.
17. `git log -p | grep -iE 'secret|token|password|BEGIN .* KEY'` → aucun résultat.
