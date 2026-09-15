# La pile, outil par outil

À lire une fois, à relire en cas de doute. Pour chaque outil : **à quoi il
sert, son équivalent dans ce que tu connais déjà, et les commandes qui
comptent.**

Le projet a été écrit en Python (FastAPI) avant de basculer en TypeScript.
La [correspondance avec l'ancienne pile](#correspondance-avec-lancienne-pile)
est en fin de page : elle permet de continuer à lire `docs/PLAN.md`, rédigé
avant la bascule.

---

## pnpm — le gestionnaire de paquets

**Remplace** `npm`, et `uv` du côté Python.

Pourquoi pas `npm` : pnpm crée un `node_modules` **strict**. Un paquet que
tu n'as pas déclaré dans `package.json` n'est **pas importable**, même s'il
est installé comme dépendance d'une dépendance. Cela élimine toute une
classe de bugs — le code qui marche chez toi parce qu'une bibliothèque était
là par hasard, et qui casse ailleurs. En prime, les paquets sont stockés une
seule fois sur la machine et reliés par lien dur : l'installation est bien
plus rapide et prend bien moins de place.

```bash
pnpm install            # installer ce que package.json déclare
pnpm add zod            # ajouter une dépendance de production
pnpm add -D vitest      # ajouter une dépendance de développement
pnpm remove zod         # retirer
pnpm <script>           # lancer un script de package.json (pnpm test, pnpm build…)
pnpm exec <binaire>     # lancer un binaire installé dans node_modules
```

`pnpm install` n'installe **que ce qui est déjà déclaré** ; c'est `pnpm add`
qui ajoute. Confondre les deux est l'erreur du premier jour.

Deux protections de pnpm 12 que tu rencontreras :

- Il **refuse d'exécuter les scripts d'installation** des paquets (une
  porte d'entrée classique des paquets malveillants). Les exceptions sont
  déclarées dans `pnpm-workspace.yaml`, sous `allowBuilds`.
- Il **refuse les versions publiées trop récemment**, le temps qu'une
  éventuelle compromission du registre soit détectée. Les exceptions vont
  dans `minimumReleaseAgeExclude`, du même fichier.

---

## Nuxt — le cadre applicatif

**Remplace** Vue + vue-router + Vite + le backend, réunis.

Tu connais déjà l'essentiel : c'est du Vue 3 avec `<script setup>`. Nuxt
ajoute quatre choses.

**Le routage par fichiers.** L'arborescence *est* le routeur, il n'y a plus
de fichier de routes à tenir :

```
app/pages/index.vue            →  /
app/pages/a-propos.vue         →  /a-propos
app/pages/article/[slug].vue   →  /article/mon-article
```

Dans `[slug].vue`, on lit le paramètre avec `useRoute().params.slug`.

**Les auto-imports.** Plus d'`import` à écrire pour un composant de
`app/components/`, un composable de `app/composables/`, ni pour les
fonctions de Vue (`ref`, `computed`, `watch`).

**Le serveur, dans le même projet.** Le dossier `server/` à la racine, avec
le même routage par fichiers. L'équivalent d'une route FastAPI :

```ts
// server/api/articles/[slug].get.ts   →  GET /api/articles/mon-article
export default defineEventHandler(async (event) => {
  const slug = getRouterParam(event, 'slug')
  const trouve = await useBase().query.article.findFirst({ where: eq(article.slug, slug) })
  if (!trouve) throw createError({ statusCode: 404, statusMessage: 'Article introuvable' })
  return trouve        // sérialisé en JSON automatiquement
})
```

**Le rendu côté serveur.** C'est la raison de la bascule. Nuxt rend la page
**sur le serveur**, envoie du HTML complet, puis Vue reprend la main dans le
navigateur. LinkedIn, WhatsApp et Google reçoivent donc l'article déjà écrit
dans la réponse HTTP, sans exécuter de JavaScript. Et les balises se
déclarent à côté des données :

```vue
<script setup lang="ts">
const { data: article } = await useFetch(`/api/articles/${route.params.slug}`)
useSeoMeta({ title: article.value.title, ogDescription: article.value.dek })
</script>
```

### Les deux pièges

**`useFetch` s'exécute deux fois** — une fois sur le serveur, une fois dans
le navigateur. Nuxt met le résultat en cache pour éviter le double appel,
mais c'est la source de confusion classique.

**Le code du serveur et celui du client ne sont pas séparés par la
syntaxe.** Ce qui est dans `server/` ne part jamais au navigateur, mais une
clé écrite dans un composant, si. D'où `runtimeConfig` : ce qui est sous
`runtimeConfig.public` est visible du navigateur, le reste est strictement
serveur. C'est l'exacte transposition du `scope: public | tech` de notre
table `setting`.

```bash
pnpm dev        # serveur de développement (on passe plutôt par Docker ici)
pnpm build      # produit .output/, autonome
pnpm preview    # sert ce build localement
```

**Nitro** est le moteur serveur de Nuxt — l'équivalent d'uvicorn. Il produit
un `.output/` qui se lance avec `node .output/server/index.mjs`, sans
`node_modules`. C'est ce qui part dans l'image Docker.

---

## Biome — le style et la qualité

**Remplace** ESLint + Prettier. C'est le `ruff` du JavaScript : un binaire
unique, écrit en Rust, qui fait le formatage **et** l'analyse, avec un seul
fichier de configuration.

```bash
pnpm check       # corrige tout ce qui peut l'être
pnpm lint        # signale sans corriger (c'est ce que fait la CI)
```

Deux limites connues, documentées dans `biome.jsonc` :

- Son support de Vue est **expérimental** et analyse le `<script>` **sans
  lire le `<template>`**. Tout ce qui ne sert que dans le template serait
  signalé à tort comme inutilisé : les deux règles concernées sont
  désactivées sur les `.vue`. C'est `pnpm typecheck` qui couvre ce cas, lui
  comprend les templates.
- Il ne remplace pas `eslint-plugin-vue`. La règle qui manquait vraiment,
  `no-v-html`, est remplacée par `scripts/hooks/check-v-html.sh` — en plus
  strict, puisqu'il exige que le fichier figure dans une liste explicite.

---

## TypeScript — le typage

**Remplace** `mypy --strict`.

```bash
pnpm typecheck   # vue-tsc --noEmit : ne produit rien, vérifie tout
```

Le point à retenir : **les types n'existent pas à l'exécution**. Ils
disparaissent à la compilation. Un JSON reçu par le réseau n'est donc pas
« vérifié » parce qu'on lui a donné un type — d'où Zod.

---

## Zod — la validation

**Remplace** Pydantic.

Valide ce qui entre (corps de requête, paramètres, variables
d'environnement) **et produit le type TypeScript au passage** : un seul
endroit à écrire, jamais de dérive entre le type et la vérification.

```ts
const schema = z.object({ titre: z.string().min(1), tags: z.array(z.string()) })
type Article = z.infer<typeof schema>   // le type découle du schéma
const donnees = schema.parse(entree)    // lève une erreur si ça ne correspond pas
```

C'est ce qui valide la configuration au démarrage
(`shared/schemas/config.ts`) et fait échouer la production quand un secret
manque.

---

## Drizzle — la base de données

**Remplace** SQLAlchemy + Alembic.

Le schéma TypeScript (`server/database/schema/`) est la **source de
vérité**. `drizzle-kit` en déduit un fichier SQL de migration, **qu'on relit
et qu'on commite**. C'est du SQL lisible, pas une boîte noire : on voit
exactement ce qui va tourner sur la base.

```bash
pnpm db:generate                  # schéma modifié → nouveau fichier dans drizzle/
docker compose run --rm migrate   # applique les migrations
pnpm db:check                     # cohérence des migrations entre elles
pnpm db:studio                    # explorateur de base dans le navigateur
```

**Le cycle** : modifier `server/database/schema/`, lancer `pnpm db:generate`,
**relire le SQL produit**, le commiter, puis appliquer. Ne jamais modifier
une migration déjà appliquée ailleurs : en ajouter une nouvelle.

**Ne jamais utiliser `drizzle-kit push`** hors bac à sable : il modifie la
base sans produire de fichier, donc sans rien de rejouable en production.

La migration s'applique toujours par un **conteneur éphémère**, jamais au
démarrage de l'application : une migration rejouée par chaque réplique, ou
un échec laissant un conteneur « en bonne santé » sur un schéma faux, rend
un déploiement irrattrapable.

---

## Vitest — les tests

**Remplace** pytest. Même rôle, syntaxe `describe` / `it` / `expect`.

```bash
pnpm test          # tout, une fois
pnpm test:watch    # en continu pendant qu'on code
pnpm coverage      # avec la couverture (seuil : 80 %)
```

Trois projets, pour ne pas payer l'environnement Nuxt sur les tests qui
n'en ont pas besoin :

| Projet | Ce qu'il couvre | Dossier |
|---|---|---|
| `unit` | fonctions pures, schémas Zod — instantané | `test/unit/` |
| `nuxt` | composants Vue, composables | `test/nuxt/` |
| `api` | routes et base PostgreSQL réelle | `test/api/` |

```bash
pnpm vitest run --project unit    # n'en lancer qu'un
```

Le seuil de 80 % porte sur **quatre** métriques (lignes, instructions,
fonctions, branches) et pas seulement sur les lignes : un seuil sur les
lignes seules se contourne trivialement.

---

## lefthook — les vérifications avant commit

L'ordonnanceur des hooks Git. Il a remplacé `pre-commit`, qui imposait
Python et `uv` dans un dépôt par ailleurs entièrement TypeScript : tout
tient maintenant sur Node et pnpm.

**Rien à installer.** Le script `prepare` de `package.json` lance
`lefthook install` à chaque `pnpm install`. Auparavant, rien ne garantissait
qu'un clone ait ses hooks posés.

```bash
pnpm hooks       # les cinq contrôles, sur tout le dépôt, sans commiter
pnpm secrets     # seulement la recherche de secrets
```

| Contrôle | Ce qu'il fait |
|---|---|
| `hygiene` | `scripts/hooks/hygiene.mjs` : espaces en fin de ligne, newline finale, CRLF, marqueurs de conflit, fichiers de plus de 512 ko, collisions de casse, YAML et JSON valides |
| `secrets` | **secretlint** — voir ci-dessous |
| `biome` | lint et format, avec correction automatique et réindexation du fichier corrigé |
| `typage` | `vue-tsc` sur le projet entier : c'est lui qui lit les templates |
| `v-html` | `scripts/hooks/check-v-html.sh` |

Le message de commit est vérifié à part, par **commitlint**, qui applique
exactement la liste de préfixes d'avant.

### secretlint — aucun secret en clair

Le garde-fou qui compte, et il compte davantage depuis que le dépôt est
public. Il a remplacé `detect-secrets` (Python) ; sa `.secrets.baseline` ne
contenait que deux faux positifs, il n'y avait pas d'acquis à perdre.

Sa détection par motifs est en revanche plus étroite que l'analyse par
entropie de `detect-secrets` : le preset recommandé laisse passer un
identifiant AWS isolé ou un bloc de clé privée. `.secretlintrc.json` ajoute
donc trois motifs maison — clé privée PEM, identifiant `AKIA`/`ASIA`, et
toute valeur un peu longue affectée à un nom contenant `SECRET`, `PASSWORD`,
`TOKEN`, `API_KEY` ou `ACCESS_KEY`.

Les `// pragma: allowlist secret` d'avant ont disparu : une valeur de test
légitime s'inscrit maintenant dans le tableau `allows` de
`.secretlintrc.json`, à un seul endroit plutôt que dispersée dans le code.

---

## Correspondance avec l'ancienne pile

`docs/PLAN.md` a été écrit avant la bascule et parle encore de FastAPI.
Cette table permet de le lire sans peine.

| Python | TypeScript |
|---|---|
| `uv`, `npm` | `pnpm` |
| `ruff` (lint + format) | Biome |
| `mypy --strict` | `tsc` / `vue-tsc` |
| `pytest` | Vitest |
| `respx` (HTTP simulé) | `vi.stubGlobal('$fetch')` |
| Pydantic | Zod |
| `Settings` (pydantic-settings) | `runtimeConfig` + Zod |
| SQLAlchemy | Drizzle ORM |
| Alembic | drizzle-kit |
| `app/routers/public/articles.py` | `server/api/articles/index.get.ts` |
| `Depends(get_session)` | `useBase()` dans le handler |
| uvicorn / gunicorn | Nitro |
| `app/render/` (injection SEO) | **supprimé** — le SSR le fait nativement |
| `markdown-it-py` + `bleach` | `marked` + `sanitize-html` (lot 5) |
| `boto3` | `@aws-sdk/client-s3` (lot 5) |
| `authlib` + `itsdangerous` | `nuxt-auth-utils` (lot 4) |
| APScheduler | tâches planifiées Nitro (lot 6) |
| Fernet | AES-256-GCM avec `node:crypto` |

La dernière ligne mérite un mot : **Fernet n'existe pas en Node** et ne doit
pas être réimplémenté. On utilise AES-256-GCM, du module `crypto` natif, qui
offre la même garantie — un chiffrement authentifié, qui détecte toute
altération du message.
