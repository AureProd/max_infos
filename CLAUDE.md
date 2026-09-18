# Règles du projet

Site **unmaxdinfo.fr** — Nuxt 4 full-stack, TypeScript, PostgreSQL, Drizzle.
Le chantier est décrit dans `docs/PLAN.md`, l'état d'avancement dans
`STATUS.md`, la pile dans `docs/STACK.md`. **Les lire avant de coder.**

## Langue

**Tout le technique est en anglais**, parce que c'est le standard : noms de
fichiers et de dossiers, routes, identifiants, commentaires, messages de
commit, libellés de test.

**Le français reste pour ce qui s'adresse à un humain :**

| Reste en français | Pourquoi |
|---|---|
| Les textes affichés aux visiteurs | C'est le contenu du site |
| Le contenu des articles (`scripts/seed/content/`) | Idem |
| Le contenu des documents (`.md`) — leurs noms, eux, sont anglais | Ils s'adressent à JB et Max |
| Les noms de variables de gabarit (`{{titre}}`, `{{sujets}}`) | Max les écrit lui-même, dans l'écran Décliner |
| Les mois de `shared/utils/format.ts` | Ils s'affichent tels quels sur le site |

Le piège du renommage est là : une chaîne de caractères peut être du contenu.
Un remplacement automatique doit donc ignorer les chaînes et le `<template>`
des composants — un `sed` ne le fait pas.

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
| `docker compose config` déplie les `env_file` **en clair** et **écarte les services à profil** | `--profile migrate` dans `./setup` ; l'artefact contient les secrets, il est en 0600 et gitignoré. En déploiement, ce qui protège est l'ORDRE : le `.env` est fabriqué APRÈS le rendu du compose |
| La forme dépliée s'écrit `NOM: valeur`, pas `NOM=valeur` | Un garde-fou qui ne cherche que `NOM=` regarde à côté de la fuite qu'il doit arrêter |
| Un conteneur qui déclare plus d'un service Traefik voit ses routeurs sans label `.service` **écartés sans erreur** | Toujours nommer le service du routeur |
| Traefik refuse de router vers un conteneur `unhealthy` | Une sonde cassée rend le site injoignable par le proxy |
| Drizzle transforme `sql\`${v}\`` en **paramètre lié**, inutilisable en DDL | `sql.raw` pour les contraintes ; **relire le SQL généré**, toujours |
| Nitro parcourt `shared/` avec rollup, qui ignore les imports `?raw` de Vite | Les données de maquette vivent dans `scripts/seed/` |
| `toLocaleString` casse l'hydratation (U+202F ou U+00A0 selon l'ICU) | Formater à la main, sans `Intl` |
| Biome lit le `<script>` des `.vue` **sans le `<template>`** | Deux règles désactivées sur les `.vue` ; `vue-tsc` prend le relais |
| Les routes Nuxt **statiques passent avant les dynamiques** : un article au slug d'un écran devient inaccessible | `RESERVED_SLUGS`, tenu à jour par un test qui lit `app/pages/admin/` |
| Un `$fetch<T>` dont on écrit le type **annule l'inférence de Nitro** et accepte n'importe quel champ | Laisser Nitro déduire : un champ renommé côté serveur doit casser le typage côté page |
| `onConflictDoUpdate` sur une colonne **sans contrainte d'unicité** échoue à l'exécution seulement | Vérifier l'index avant de viser une colonne |
| Le code d'OAuth Instagram donne un jeton d'**une heure** | Le second échange (`ig_exchange_token`) est obligatoire, sinon l'intégration meurt au bout d'une heure |
| Un `sed` sur du code touche aussi les **chaînes** et le `<template>` | Renommer par un lexeur : apostrophes de commentaires, gabarits imbriqués et littéraux regex cassent toute regex |
| Entre Biome (qui lit le `<script>` sans le `<template>`) et `vue-tsc` (pour qui un composant auto-importé inconnu n'est pas une erreur), un `<Foo>` inexistant ou une prop non déclarée **partent en production sans un mot** | `scripts/hooks/vue-templates.mjs`, dans `pnpm hooks` |
| Deux suites `pnpm test` en parallèle partagent la **même base de test** | Elles se truncatent mutuellement : lancer une seule suite à la fois |
| Un nom absent de **toute règle de routeur** Traefik est absent de la demande ACME : il sert le `TRAEFIK DEFAULT CERT`, et le navigateur avertit avant même le 404 | Élargir la `rule`, pas seulement le DNS. Tenu par `test/unit/deploy-labels.spec.ts` |
| `traefik.…routers.X.middlewares=` est **UNE valeur** séparée par des virgules : réécrire la clé ne garde que la dernière | Tenu par `test/unit/deploy-labels.spec.ts`, qui exige que tout middleware déclaré soit chaîné |
| Le défi ACME **TLS-ALPN-01 ne traverse pas un proxy** : derrière le nuage orange de Cloudflare, aucun certificat n'est jamais émis | `@` et `www` en *DNS only*. Voir « Décisions arrêtées » |
| `docker compose config` **déplie `env_file` en clair même avec `--no-env-resolution`** — mesuré, sortie identique au bit près | Les quatre options du rendu, tenues par `scripts/hooks/compose-artifact.mjs` |
| `docker compose config` grave le **nom de projet du rendu** dans `name:` et dans les volumes : `up -d` fabrique alors un nouveau `db_data` et orpheline la base pendant que le site répond | `--no-normalize` et `sed '/^name:/d'`. Tenu par le même garde-fou |
| Le préflight CORS d'un `PUT` presigné vers R2 échoue **sans code de statut** : le navigateur ne dit que `Failed to fetch`, et le serveur ne voit rien passer | La règle du seau est versionnée dans `scripts/r2-cors.ts` (`pnpm r2:cors`), qui **relit** ce que le seau répond |
| `getSignedUrl` signe **sans corps** : depuis 3.729 le SDK AWS y grave le CRC32 du vide (`x-amz-checksum-crc32=AAAAAA==`), et R2 rejette ensuite le fichier réel | `requestChecksumCalculation: 'WHEN_REQUIRED'` sur le `S3Client`. Tenu par `test/unit/storage.spec.ts` |
| `social_post.source` a pour défaut **`'manual'`** : il dit la PROVENANCE, pas le placement. Filtrer dessus affiche deux fois le même billet sur l'accueil | Pour « quel billet n'a pas de section », filtrer sur `account_id IS NULL` |
| Un reset d'élément (`button { … }`) dans `base.css` **bat PrimeVue** : une couche gagne sur la spécificité, et `site` passe après `primevue` | Tous les boutons de la bibliothèque perdaient fond et bordure, sans un mot. `button:not([class])`, comme `a` et `label` |
| `BBH Hegarty`, la police de titres du Substack, n'a **aucun glyphe accentué** — 121 glyphes, mesurés | Chaque `é` d'un titre français tombe dans une autre police. Gabarito à la place ; tenu par `test/e2e/layout.spec.ts` |
| Une **seconde clé `vite:`** dans `nuxt.config.ts` n'est pas fusionnée, elle écrase | Le plugin Tailwind ne tournait pas, et `@tailwind utilities` partait tel quel dans la feuille servie |
| L'instruction `@layer a, b, c;` écrite dans `main.css` est **compilée et supprimée** par Tailwind | C'est PrimeVue qui l'écrit, depuis `cssLayer.order`. Sans elle, les couches retombent sur l'ordre d'apparition et PrimeVue, injecté en dernier, bat tout utilitaire |
| Un module importé par le **script de semis** ne peut pas dépendre de l'alias `#shared` : il tourne sous `tsx` | D'où `derivedFields` dans `markdown.ts` et non dans `articles.ts`. Même raison que le commentaire de `schema/enums.ts` |
| **Tiptap ne garde que ce que son schéma décrit** : un attribut inséré tel quel disparaît à la sérialisation | Étendre le nœud (`ParagraphWithCta`), et n'admettre que la valeur voulue |
| Tailwind v4 ne génère **que les classes trouvées dans les fichiers source** | Une classe ajoutée depuis JavaScript est simplement absente de la feuille — ce qui se lit exactement comme perdre la cascade |
| Les trois projets Playwright tournent **en parallèle contre la même base** | Deux tests qui visent « la première ligne » se marchent dessus, et publier change `updatedAt`, donc l'ordre. Viser par titre, pas par rang |
| `useRequestHeaders()` — donc `sessionHeaders()` — appelée **après un `await`** dans une fonction ordinaire tombe sur `NUXT_E1001`, « Nuxt instance unavailable » | L'écran d'édition sortait en **500**, mais seulement sous charge : le contexte survit parfois à un await. Capturer les en-têtes dans le `setup`, une fois |
| Un serveur Nuxt laissé tourner **sur une construction précédente** sert un `buildId` périmé : le client recharge la page de force, en plein test | `/_nuxt/builds/meta/<id>.json` en 404 dans le journal. Redémarrer le serveur après chaque `pnpm build` |
| Un clic Playwright envoyé **avant l'hydratation** tombe sur du HTML sans gestionnaire et ne fait rien — sans erreur | `await page.waitForLoadState('networkidle')` après un `goto` sur un écran qui charge ses données côté client |
| Une barre d'outils d'éditeur **vole le focus** au clic, et la sélection se perd avant la commande | `@mousedown.prevent` sur chaque bouton |
| `editor.isActive()` lit l'état de ProseMirror, qui vit **hors de Vue** : rien ne prévient le composant | Un compteur touché à chaque transaction, relu par la fonction — sans quoi les boutons ne se rallument qu'au prochain rendu |
| La valeur d'un `.default()` de Zod **ne repasse pas par le schéma** | `.default({})` sur un objet dont chaque champ vaut `true` par défaut rend `{}` tel quel : toutes les rubriques se lisaient `undefined`, donc masquées. Écrire le défaut en toutes lettres |
| Une règle écrite sans `.admin-ui` pèse **une classe de moins** que sa consœur générique | Elle passe dessous sans rien changer, et sans erreur. C'est ce qui annulait le rembourrage des cartes de compétences, et ce qui faisait reprendre au menu de l'en-tête le chevron et le rembourrage de `.admin-ui select` |
| Le chevron natif d'un `<select>` **ignore `padding-right`** sous Chrome | Il touchait le trait du cadre. Dessiné par deux dégradés en `currentColor`, il suit la couleur du texte sans figer une teinte de plus |
| Une adresse écrite en toutes lettres est **UN mot** : sa largeur min-content remonte jusqu'à la page | Elle se met à défiler de côté, et une fenêtre modale centrée part avec elle — le dialogue coupé au bord droit n'est que le symptôme. `overflow-wrap: anywhere` sur les liens du corps. Tenu par `test/e2e/public.spec.ts` |
| Un `<style scoped>` de composant porte un **attribut de portée** : il bat toujours la feuille commune | Une règle écrite dans `base.css`, même sous media query, ne peut pas corriger ce qu'un composant a posé. Elle doit vivre dans le composant |
| `flex-basis` dans un conteneur **en colonne** est une HAUTEUR | `.a-btn-block` porte `flex: 1 1 260px` : replié en colonne sur un téléphone, le bouton faisait 260 px de haut |
| Un sélecteur d'icône trop large (`.bloc i`) attrape aussi **l'icône du bouton posé dans le bloc** | L'icône de « Téléverser » se peignait en gris sur son fond bleu. `> i` pour ne viser que l'état vide |

## Décisions arrêtées

Elles ne se rediscutent pas à chaque séance. Chacune dit *pourquoi*, et ce qui
la tient.

**En production, HTTPS et rien d'autre.** Le port 80 du VPS reste fermé, et
c'est voulu : ce n'est pas une panne à réparer. Le HTTP en clair n'existe qu'en
développement local, où `./setup` pose `URL_SCHEME=http`. Corollaire : ne jamais
ajouter au déploiement un contrôle qui exige une redirection depuis `http://` —
il échouerait sur un port délibérément clos.

**`@` et `www` sont en *DNS only* chez Cloudflare ; `media` reste proxifié.**
Le proxy empêchait le défi ACME TLS-ALPN-01 d'aboutir : l'origine n'a servi
qu'un certificat auto-signé jusqu'au 16/09/2026. `media` est le domaine
personnalisé du bucket R2, qui lui ne fonctionne QUE proxifié — et c'est aussi
pourquoi la zone reste chez Cloudflare. Conséquence à retenir : les réglages de
bord de Cloudflare (*Always Use HTTPS*, *Redirect Rules*, HSTS) ne s'exécutent
plus. Ils vivent désormais dans les labels Traefik du dépôt, donc versionnés.

**Le serveur ne reçoit qu'un seul `docker-compose.yml`**, rendu par la CI. Aucun
`-f` à recombiner : la commande tapée sur le VPS en dépannage est exactement
celle qui tourne.

**Le back-office ne règle pas l'apparence.** Max y choisit les articles, les
publications et les informations d'à propos — jamais le visuel ni l'agencement
des sections. Le rendu est fixé dans le code (décision de JB, 16/09/2026).

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
- **Claude ne lit ni n'utilise les secrets réels**, même présents en local
  (`.env.dev`, `.env*`, clés R2, Google OAuth, Instagram). Il n'ouvre pas ces
  fichiers, n'en affiche pas le contenu, et ne lance aucun script qui s'en
  sert — `pnpm r2:cors`, une synchronisation Instagram, un appel à l'API Meta.
  Il écrit le script, donne la commande, et **c'est JB qui la lance**. Même
  règle que `git push` : l'action qui sort de la machine appartient à JB.

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
