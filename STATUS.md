# Où on en est — reprise du chantier

> Dernière séance : **jeudi 17 septembre 2026**. **Les onze lots sont écrits,
> et la refonte du style est faite.**
> Pour reprendre : lancer `claude` dans `~/Documents/perso/max_infos` et dire
> « reprends le chantier, lis STATUS.md ».

## Lire d'abord

- **[`docs/GOING-LIVE.md`](docs/GOING-LIVE.md)** — **ce qui reste à
  faire pour que le site existe** : Google, R2, Meta, GitHub, VPS
- **[`README.md`](README.md)** — démarrage et commandes du quotidien
- **[`docs/STACK.md`](docs/STACK.md)** — la pile, si elle est nouvelle pour toi
- **[`docs/PLAN.md`](docs/PLAN.md)** — le cahier des charges, avec son bandeau de
  mise à jour : il a été écrit pour FastAPI, le projet est en TypeScript
- **[`CLAUDE.md`](CLAUDE.md)** — les règles et ce qui casse en silence

## Avancement

| Lot | État |
|---|---|
| 1 — Dépôt, outillage qualité, CI | ✅ |
| 2 — Nuxt + Postgres + Drizzle + `./setup` + Traefik de dev | ✅ |
| 3 — API publique en lecture + contenu migré en base | ✅ |
| 4 — OAuth Google, rôles, sessions | ✅ |
| 5 — Back-office : articles, médias, tags | ✅ |
| 6 — Instagram : jeton chiffré, synchronisation, cartes maison | ✅ |
| 6 bis — Plusieurs comptes Instagram, réglés depuis l'écran Réseaux | ✅ |
| 7 — Rattachement, LinkedIn manuel, gabarits | ✅ |
| 8 — Réglages : CV, contact, à propos | ✅ |
| 9 — Référencement : flux, plan du site, JSON-LD, cache | ✅ |
| 10 — Export / import avec aller-retour vérifié | ✅ |
| 11 — CI, compose de production, déploiement | ✅ écrit, **pas encore exécuté** |
| 12 — Refonte du style, public et back-office | ✅ |

**841 tests Vitest et 112 tests Playwright.** `pnpm verify` et `pnpm hooks`
passent.

Le back-office est complet : tableau de bord avec ses graphiques de lecture,
articles écrits dans un vrai éditeur, **Tags**, publications, **Réseaux**,
à propos, CV illustré (photo + PDF), et un écran Technique qui garde la
sauvegarde et les comptes autorisés.

## Lot 12 — la refonte du style

Le site est le portfolio de Max : il devait prouver la qualité de son
travail, pas seulement l'exposer. Le rendu reprend l'identité de son
Substack, relevée dans le HTML qu'il sert — accent `#2563eb` et non l'orange
`#FF6719` de la plateforme, corps en **Lexend**, colonne de lecture à
728 px.

**La police de titres n'est PAS la sienne, et c'est mesuré.** Le fichier que
Google sert pour `BBH Hegarty` contient 121 glyphes et aucun caractère
accentué : chaque `é` d'un titre français va se chercher dans une autre
police. Le défaut est visible sur le Substack de Max lui-même (« sols
craquelés »). **Gabarito** tient la même densité géométrique et couvre le
français ; un test Playwright mesure qu'aucun accent ne tombe en repli.

Ce que la refonte a apporté d'autre :

- **Tailwind v4 et primeicons**, en plus de PrimeVue. L'ordre des couches est
  le point délicat : `theme, base, primevue, site, components, utilities`,
  et c'est **PrimeVue qui écrit l'instruction `@layer`**. Voir `docs/STACK.md`.
- **Des tests navigateur.** Vitest prouve ce que le serveur envoie ; rien ne
  prouvait ce que le navigateur montre. Playwright mesure l'absence de
  débordement horizontal, l'ordre des sections, la ligne unique des tags et
  le repli des tableaux — aux trois largeurs, 390, 820 et 1440 px.
- **Des toasts**, à la place de six machines d'état recopiées et de sept
  `confirm()` natifs.
- **Le rôle `tech` est devenu `developer`.** La migration `0006` accepte les
  deux noms le temps d'un déploiement ; une migration ultérieure resserrera
  la contrainte.
- **Le corps d'un article est du HTML**, écrit dans Tiptap. Une colonne
  `body_text` porte le texte brut, sur lequel la recherche travaille — elle
  cherchait dans le Markdown, et « **souveraineté** » ne répondait pas à
  « souveraineté ». `bodyMd` n'est plus écrite : elle sera retirée par une
  migration ultérieure.

### Deux défauts trouvés en chemin

**Un titre contenant une apostrophe était tronqué à l'import.** Le motif
capturait `content="([^"']*)"` — une classe qui exclut les DEUX guillemets
quel que soit le délimiteur ouvrant — et « L'enquête sur le pouvoir »
arrivait sous le titre « L ». En français, ce n'est pas un cas limite.

**Une section entière de back-office vivait dans `base.css`**, la feuille
chargée par chaque visiteur, sous des noms sans préfixe que le garde-fou
existant ne regardait pas. Elle ne servait plus le site et peignait toujours
l'administration : le champ « Présentation » de l'écran À propos faisait
460 px de haut à cause d'un `min-height` écrit là pour le corps d'un article.

### Ce que Max peut montrer ou cacher

Les interrupteurs s'arrêtaient aux rubriques datées du CV. Les compétences,
les langues, les certifications et les centres d'intérêt partaient sur le
site quoi qu'il arrive. Chacune porte maintenant le sien, chaque groupe de
compétences aussi, et la coupe se fait dans `publicCv` avec celle des
rubriques datées : **ce qui est masqué ne voyage pas** dans `/api/site`.
Les contacts se réordonnent — leur ordre ici est celui de la page publique.

Aucune migration : `listsVisible` et le `visible` d'un groupe sont des
champs de réglage, absents ils valent « visible ». Un CV enregistré avant
ce champ ne disparaît pas.

### Plusieurs comptes Instagram

Le compte Instagram était un jeton unique dans `secret` et un profil figé dans
le réglage `instagram_public`. C'est désormais une table, `social_account` :
une ligne par compte, un jeton par compte (`instagram_access_token:<id>`), et
`social_post.account_id` qui dit d'où vient chaque publication.

- **L'accueil affiche une section par compte**, dans l'ordre et au nombre de
  publications choisis. Le nom, la photo et la bio viennent du profil Meta à
  chaque synchronisation : rien ne se saisit à la main.
- **`/admin/social`**, ouvert au rôle `editor` : connecter un compte,
  l'ordonner, le masquer, le resynchroniser, le déconnecter. Instagram a
  quitté l'écran Technique — les secrets de l'application Meta, eux, ne
  quittent pas le serveur.
- **Déconnecter efface** le compte, ses publications et leurs rattachements
  (cascade SQL vérifiée par un test). L'écran annonce le nombre de
  publications concernées avant de le faire.
- L'archive d'export passe en **version 2** : elle emporte `social_account`,
  sans quoi une restauration sur base vierge échouerait sur la clé étrangère.
- Le réglage `instagram_public` a disparu des schémas. La migration `0004` ne
  supprime ni son enregistrement ni l'ancienne clé de jeton : l'ancien
  conteneur les lit encore pendant le déploiement.

## ⚠ Ce qui t'attend, et qui bloque la mise en ligne

**Il n'y a plus de code à écrire pour ouvrir le site — il reste des comptes
à créer.** Tout est testé contre des services simulés ; rien n'a jamais
parlé aux vrais.

La marche à suivre complète, dans l'ordre, avec les noms de variables exacts
et les pièges de chaque fournisseur : **[`docs/GOING-LIVE.md`](docs/GOING-LIVE.md)**.
En résumé : dépôt GitHub public, OAuth Google, bucket Cloudflare R2, app
Meta, domaine et DNS, secrets de déploiement.

Deux points à ne pas rater, parce qu'ils ne se rattrapent pas :

- **Avant** de rendre le dépôt public, relire `docs/PLAN.md` : ses exemples
  JSON contiennent des données personnelles de Max. Une clé ou une donnée
  poussée sur un dépôt public est compromise irréversiblement.
- `NUXT_BOOTSTRAP_TECH_EMAIL` est le **seul** moyen d'obtenir un premier
  compte : personne ne peut s'en créer un.

## Ce qui reste en dette

- **`docker compose watch`** rebâtirait l'image quand `pnpm-lock.yaml` change.
  Le piège s'est produit **trois fois** (tsx, nuxt-auth-utils, puis marked) :
  l'image garde un `node_modules` périmé et l'erreur ne dit pas pourquoi.
  Contrepartie : `up --watch` tourne au premier plan.
- **HTTPS en local** (mkcert) — les cookies `Secure` ne sont pas posés en clair,
  et Google exige des URI de redirection HTTPS hors localhost. À faire avant de
  déboguer l'authentification pour de vrai.
- **Pas de test de bout en bout navigateur** (Playwright). Tout est vérifié par
  requêtes HTTP contre un vrai serveur, ce qui couvre le rendu serveur mais pas
  l'interaction. Les écrans les plus exposés à ce manque sont ceux qui
  téléversent : le fichier part du navigateur directement vers R2, et ce
  chemin-là n'est prouvé par aucun test.
- **Les couvertures reprises de Substack pointent vers son CDN** : `r2_key`
  reste nulle. Si Max ferme son Substack, elles disparaissent et il faudra
  les retéléverser depuis l'écran d'édition.
- **L'import depuis l'écran Technique ne fait que simuler.** Appliquer une
  restauration passe encore par l'API. C'est volontaire tant que personne
  n'a restauré une vraie sauvegarde au moins une fois.

## Ce qui casse en silence — à relire avant de coder

Chaque ligne a coûté du temps. Elles sont aussi dans `CLAUDE.md`.

| Piège | Ce qu'il faut savoir |
|---|---|
| `process.env` dans `nuxt.config.ts` | **Figé au build**. Tout ce qui varie à l'exécution passe par `NUXT_*` |
| `docker compose config` | Déplie les `env_file` et **écarte les services à profil** (`--profile migrate`) |
| Traefik | Ne lit sa config statique **qu'au démarrage** ; refuse de router vers un conteneur *unhealthy* ; écarte **sans erreur** un routeur qui ne nomme pas son service |
| Drizzle | `sql\`${v}\`` devient un **paramètre lié**, inutilisable en DDL → `sql.raw`. **Relire le SQL généré** |
| Identifiants | `GENERATED BY DEFAULT`, jamais `ALWAYS` : sinon aucun import ne peut restaurer les liaisons. Et **resynchroniser les séquences** après import |
| `useFetch` | Range le 404 dans `error` et rend quand même : il faut le **propager** |
| `useRuntimeConfig` | À appeler dans le contexte du composant, jamais dans une fonction passée à `useHead` |
| `toLocaleString` | Casse l'hydratation (U+202F ou U+00A0 selon l'ICU) |
| Nitro | Parcourt `shared/` avec rollup, qui ignore les imports `?raw` de Vite |
| Biome | Lit le `<script>` des `.vue` **sans le `<template>`** |
| Serveur de dev Nuxt | Sert la page d'erreur en **200** ; le build de production répond bien 404 |
| Routes Nuxt | Les **statiques passent avant les dynamiques** : un article dont le slug est celui d'un écran devient inaccessible, sans message. D'où `SLUGS_RESERVES` |
| `$fetch<T>` écrit à la main | Annule l'inférence de Nitro et **accepte n'importe quel champ**. Laisser Nitro déduire |
| `onConflictDoUpdate` | Exige une contrainte d'unicité **réelle** sur la cible ; sinon, échec à l'exécution seulement |
| Jeton Instagram | Le code d'OAuth donne un jeton d'**une heure**. Sans le second échange, l'intégration meurt au bout d'une heure |
| Zod | La valeur d'un `.default()` **ne repasse pas par le schéma** : `.default({})` laisse chaque champ `undefined` |
| Spécificité CSS | Une règle écrite sans son préfixe pèse **une classe de moins** que sa consœur générique et passe dessous, sans erreur |
| `<select>` natif | Son chevron **ignore `padding-right`** sous Chrome |
| Une adresse écrite en toutes lettres | Est **UN mot** : sa largeur min-content fait défiler la page, et une fenêtre modale centrée part avec elle |
| `<style scoped>` | Porte un attribut de portée : il **bat toujours** la feuille commune, même sous media query |
| Routes publiques | Un brouillon ne répond 404 que là où le **statut** est regardé : le compteur de lecture et les billets liés ne le regardaient pas |
| Requête partie du serveur | Une adresse écrite par l'utilisateur atteint le réseau interne — et les **redirections** contournent le garde |
| Import d'archive | C'est une ENTRÉE, pas une source de vérité : le corps d'article y est réassaini |
| `<![CDATA[…]]>` | Se ferme au **premier** `]]>` rencontré |
| En-têtes de sécurité | Ils vivaient chez Cloudflare, dont le proxy ne s'exécute plus. Ils sont dans `routeRules` |

## Les frontières à ne jamais franchir

Elles sont tenues par des tests qui **s'auto-alimentent** : une route ou un
réglage ajouté demain est couvert sans que personne n'y pense.

- Le test d'autorisations **inventorie `server/api/admin/` par le système de
  fichiers** et exige que la matrice le couvre exactement.
- Le test des réglages **énumère `SETTING_SCOPE`** : chaque clé technique doit
  répondre 403 à un `editor`.
- `social_post.raw` n'apparaît dans aucune réponse. La table `secret` n'est
  jamais exportée. Un brouillon répond 404, jamais 403.
- Le site **ne publie jamais** sur les réseaux.
