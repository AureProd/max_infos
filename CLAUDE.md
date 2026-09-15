# Règles du projet

Site **unmaxdinfo.fr** — Nuxt 4 full-stack, TypeScript, PostgreSQL, Drizzle.
Le chantier est décrit dans `docs/PLAN.md`, l'état d'avancement dans
`REPRISE.md`, la pile dans `docs/OUTILS.md`. **Les lire avant de coder.**

## Langue

Tout est en français : commentaires, docstrings, messages de commit, noms de
variables métier. Les identifiants techniques imposés par un cadre (`default`,
`index`, `slug`) restent tels quels.

## Méthode

**TDD.** Le test d'abord, rouge, puis le code. Un test qui n'a jamais échoué ne
prouve rien.

**Commits conventionnels**, un hook les refuse sinon. Un commit explique
*pourquoi*, pas *quoi* — le diff dit déjà le quoi.

**Vérifier plutôt que supposer.** Ce projet a livré plusieurs correctifs trouvés
en exerçant la pile, jamais en la relisant : contraintes SQL sorties avec des
paramètres liés, routeur Traefik écarté sans message d'erreur, conteneur de
migration appliquant un jeu périmé tout en répondant « applied successfully ».

## Ce qui casse en silence — à connaître

| Piège | Ce qu'il faut faire |
|---|---|
| Ce que `nuxt.config.ts` lit par `process.env` est **figé au build** | Tout ce qui varie à l'exécution passe par `runtimeConfig` et une variable `NUXT_*` |
| `docker compose config` déplie les `env_file` et **écarte les services à profil** | `--profile migrate` dans `./setup` ; l'artefact contient les secrets, il est en 0600 et gitignoré |
| Un conteneur qui déclare plus d'un service Traefik voit ses routeurs sans label `.service` **écartés sans erreur** | Toujours nommer le service du routeur |
| Traefik refuse de router vers un conteneur `unhealthy` | Une sonde cassée rend le site injoignable par le proxy |
| Drizzle transforme `sql\`${v}\`` en **paramètre lié**, inutilisable en DDL | `sql.raw` pour les contraintes ; **relire le SQL généré**, toujours |
| Nitro parcourt `shared/` avec rollup, qui ignore les imports `?raw` de Vite | Les données de maquette vivent dans `scripts/seed/` |
| `toLocaleString` casse l'hydratation (U+202F ou U+00A0 selon l'ICU) | Formater à la main, sans `Intl` |
| Biome lit le `<script>` des `.vue` **sans le `<template>`** | Deux règles désactivées sur les `.vue` ; `vue-tsc` prend le relais |
| Les routes Nuxt **statiques passent avant les dynamiques** : un article au slug d'un écran devient inaccessible | `SLUGS_RESERVES`, tenu à jour par un test qui lit `app/pages/redaction/` |
| Un `$fetch<T>` dont on écrit le type **annule l'inférence de Nitro** et accepte n'importe quel champ | Laisser Nitro déduire : un champ renommé côté serveur doit casser le typage côté page |
| `onConflictDoUpdate` sur une colonne **sans contrainte d'unicité** échoue à l'exécution seulement | Vérifier l'index avant de viser une colonne |
| Le code d'OAuth Instagram donne un jeton d'**une heure** | Le second échange (`ig_exchange_token`) est obligatoire, sinon l'intégration meurt au bout d'une heure |

## Frontières à ne jamais franchir

- **Aucun secret dans le dépôt.** Il est public : une clé poussée est compromise
  immédiatement et irréversiblement.
- **`scope: 'tech'` ne sort jamais d'une réponse publique.** Le filtre est en
  SQL, pas en JavaScript, pour qu'un oubli soit impossible.
- **`social_post.raw` n'est jamais exposé** — c'est la charge brute de Meta.
- **Un brouillon répond 404, pas 403.** Un 403 confirmerait son existence.
- **Le site ne publie jamais sur les réseaux.** Il découvre, affiche, assiste.
- **`v-html`** n'est admis que dans les fichiers listés par
  `scripts/hooks/check-v-html.sh`, avec sa justification.

## Base de données

Le schéma TypeScript est la source de vérité. Après l'avoir modifié :

```bash
pnpm db:generate                  # produit le SQL
# RELIRE drizzle/00xx_*.sql
docker compose run --rm migrate   # applique
```

Jamais `drizzle-kit push`. Jamais modifier une migration déjà appliquée
ailleurs : en ajouter une nouvelle. Les migrations doivent rester **compatibles
vers l'arrière** le temps d'un déploiement, l'ancien conteneur tournant encore
quand le nouveau schéma est appliqué.

## Avant de pousser

```bash
pnpm verify              # lint + typage + tests + build
pnpm hooks               # les cinq contrôles de commit, sur tout le dépôt
```
