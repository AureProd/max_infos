# Où on en est — reprise du chantier

> Dernière séance : **lundi 14 septembre 2026**.
> Pour reprendre : lancer `claude` dans `~/Documents/perso/max_infos` et dire
> « reprends le chantier, lis REPRISE.md ».

## Le plan

Le plan complet est dans **[`docs/PLAN.md`](docs/PLAN.md)** : contexte, décisions
arrêtées, contraintes des API tierces, modèle de données, API, back-office,
export/import, Docker/Traefik/CI, qualité, découpage en 11 lots, vérification.

**Le lire en entier avant de coder**, en tenant compte de son bandeau de mise à
jour : le plan a été écrit pour Python, le projet est en TypeScript. Il contient
des contraintes vérifiées qu'il ne faut pas réapprendre — la découverte
automatique LinkedIn est impossible, Substack n'a pas d'API de publication, et
le site **ne publie jamais** sur les réseaux.

Si la pile est nouvelle pour toi : **[`docs/OUTILS.md`](docs/OUTILS.md)**.

## La bascule vers TypeScript

Le lot 1 avait été livré en **Python / FastAPI**. Avant d'attaquer le lot 2, on a
basculé sur **Nuxt 4 full-stack, tout en TypeScript**.

Le motif décisif : la section « Référencement sans migration Nuxt » du plan
décrivait un module `app/render/` qui devait ré-injecter à la main les balises
`<title>`, Open Graph et JSON-LD dans `index.html`, plus un second moteur
Markdown côté serveur. **Toute cette complexité n'existait que pour éviter
Nuxt**, dont le rendu serveur est natif. S'y ajoutent : JB connaît déjà Vue, les
types du schéma remontent jusqu'aux composants, et le back-office (lots 5 à 8,
le gros du travail) est du Vue dans les deux cas.

C'était le moment le moins coûteux : le lot 1 ne contenait que de l'outillage,
aucune logique métier. Ses **décisions** ont toutes été conservées — liste des
secrets obligatoires en production, contraintes SQL nommées, baseline
`detect-secrets`, mode différentiel de `pre-commit` en CI.

Le dépôt sera **public** (le plan disait privé).

## Avancement

| Lot | État |
|---|---|
| **1 — Dépôt, structure, outillage qualité, CI** | ✅ refait en TypeScript |
| **2 — Nuxt + Postgres + Drizzle + modèles + `./setup` + Traefik de dev** | ✅ **terminé** |
| **3 — API publique en lecture + migration du contenu** | ⏭ **à faire, prochaine étape** |
| 4 → 11 | à faire, voir `docs/PLAN.md` |

### Ce qui tourne, vérifié

```bash
./setup && docker compose run --rm migrate && docker compose up -d --wait
curl http://unmaxdinfo.localhost:8080/api/health        # {"status":"ok",…}
curl http://unmaxdinfo.localhost:8080/api/health/ready  # {"database":"ok",…}
```

- Les 10 tables du plan sont en base, par la migration `drizzle/0000_initial.sql`
- Le rendu **serveur** est confirmé : le contenu est dans la réponse HTTP
- Une page inexistante renvoie un vrai **404** (l'ancien routeur redirigeait
  vers l'accueil — mauvais pour le référencement)
- Le rechargement à chaud passe par Traefik : modification répercutée en ~1 s
- Le tableau de bord Traefik (18080) ne liste **que** les conteneurs du projet
- 23 tests, `pnpm lint` et `pnpm typecheck` propres, `pre-commit` complet vert

### Trois corrections faites au passage, à ne pas défaire

1. **`useFilters` passait son état au niveau du module** — en rendu serveur,
   une fuite entre visiteurs, le module étant instancié une fois par processus
   Node. Réécrit en `useState`. Un test le couvre.
2. **`nb()` appelait `toLocaleString('fr-FR')`**, qui produit U+202F ou U+00A0
   selon la version d'ICU : écart d'hydratation sur chaque nombre. Réécrit à la
   main, test sur les points de code exacts.
3. **Le moteur Markdown écrivait `href="$2"` sans rien vérifier** : une cible
   `javascript:` s'exécutait. Sans conséquence tant que seul Max écrit — mais
   l'**import Substack du lot 3** y fera passer du texte qu'il n'a pas écrit.

### Prochaine étape : le lot 3

API publique en lecture, puis migration du contenu en dur vers la base.
Le contenu attend dans `app/data/*.ts` et `scripts/seed/content/*.md`.

Deux points à trancher au moment de la migration, signalés par l'exploration :

- `article.ratio` n'existe pas dans le modèle de données : soit le dériver des
  dimensions du média, soit ajouter la colonne.
- `article.chars` sert de **graine au visuel de repli** (`chars % 97`) :
  recalculer la valeur à l'import changerait le visuel des cinq articles
  existants. Reprendre les valeurs du fichier pour ceux-là, recalculer pour les
  nouveaux.
- Les identifiants `ig-1` et `ig-2` de `instagram.ts` et `posts.ts` se
  chevauchent en pointant vers des articles **différents** : incohérence de
  maquette à arbitrer.

## Détails d'implémentation à connaître

- **`runtimeConfig` et le préfixe `NUXT_`** : tout ce que `nuxt.config.ts` lit
  par `process.env` est **figé au build**. Sans ce préfixe, une image construite
  en CI embarquerait les variables du runner GitHub. Seul `NUXT_PUBLIC_*` part
  au navigateur.
- **Deux sondes.** `/api/health` ne fait aucune entrée-sortie : c'est elle
  qu'interroge le healthcheck, donc elle qui conditionne le routage Traefik, qui
  refuse de servir un conteneur *unhealthy*. `/api/health/ready` fait le
  `SELECT 1`.
- **Un routeur Traefik doit nommer son service** dès qu'un conteneur en déclare
  plus d'un, sinon il est écarté **sans message d'erreur** — symptôme : 404 à
  travers le proxy, 200 en direct sur le conteneur.
- **`docker compose config` déplie les `env_file`** dans l'artefact : les
  secrets y sont, il n'existe pas d'option pour l'éviter. Le fichier est écrit
  en 0600 et gitignoré.
- **`docker compose config` écarte les services à profil** : d'où
  `--profile migrate` dans `./setup`.
- **Colonnes `text` + `CHECK`, jamais `pgEnum`** : `ALTER TYPE … ADD VALUE` ne
  s'exécute pas dans une transaction, or une migration est jouée en bloc. Un
  tuple TypeScript alimente le type, le SQL et Zod.
- **Biome ne lit pas les `<template>` Vue** : deux règles sont désactivées sur
  les `.vue`, `vue-tsc` prend le relais.
- **Nitro parcourt `shared/` avec rollup**, qui ignore les imports `?raw` de
  Vite : les données de maquette vivent donc dans `app/data/`, pas dans
  `shared/`.
- **Le WebSocket de rechargement à chaud est porté par le serveur principal**
  (`/_nuxt/_hmr`), et non par un port séparé : aucun routeur Traefik dédié n'est
  nécessaire, seul `clientPort` l'est.

## Décisions encore ouvertes (aucune ne bloque)

- Créer le dépôt GitHub **public** et y pousser `main` — et **avant de le rendre
  public**, passer
  `git log -p | grep -iE 'secret|token|password|BEGIN .* KEY'`, puis activer
  *Secret scanning*, *Push protection*, CodeQL et Dependabot
- Relire `docs/PLAN.md` avant publication : ses exemples JSON contiennent des
  données personnelles de Max (CV, téléphone)
- Créer l'app Meta et connecter le compte Instagram (@unmaxdinfo_ est déjà en
  Pro) — nécessaire au lot 6
- Acheter `unmaxdinfo.fr` chez Infomaniak et déléguer le DNS à Cloudflare —
  lot 11
- Créer le bucket Cloudflare R2 et ses clés — lot 5
