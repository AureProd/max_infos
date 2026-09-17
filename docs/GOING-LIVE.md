# Mise en ligne — ce qu'il reste à configurer

Tout le code est écrit et testé contre des services **simulés**. Il n'a
jamais parlé aux vrais. Ce document est la liste de ce qu'il faut ouvrir,
créer et coller, dans l'ordre où chaque étape débloque la suivante.

> **Compter deux bonnes heures**, dont une d'attente : la propagation DNS et
> la revue Meta ne dépendent pas de toi.

## Où va quoi — à lire une fois

Il y a **deux endroits** différents où poser une valeur, et les confondre
est la première source de perte de temps.

| Endroit | Quoi | Comment |
|---|---|---|
| `.env.dev` (ta machine) | de quoi développer en local | `./setup` le crée et remplit les secrets locaux |
| Secrets et variables GitHub | **toute la production** | Settings → Secrets and variables → Actions → environnement `production` |

Le VPS ne détient plus aucun secret en propre : il reçoit une **clé SSH
publique**, et rien d'autre. Son `.env` est fabriqué par GitHub Actions à
chaque déploiement, puis écrasé au suivant — le modifier sur le serveur ne
sert à rien, la modification disparaît.

Deux familles de noms, et la frontière compte :

- **Sans préfixe** (`URL_HOST`, `POSTGRES_*`, `DATABASE_URL`) : lues par
  Docker Compose, Traefik, Postgres et drizzle-kit.
- **`NUXT_*`** : lues par l'application **au démarrage**. C'est le seul
  mécanisme qui injecte à l'exécution. `NUXT_PUBLIC_*` part jusqu'au
  navigateur — n'y mettre que du public.

---

## 1. GitHub — le dépôt public

**Avant de pousser**, une seule fois :

```bash
git log -p | grep -iE 'secret|token|password|BEGIN .* KEY'   # → aucun résultat
```

Une clé poussée sur un dépôt public est compromise **immédiatement et
irréversiblement** : les forks et les caches GitHub la gardent malgré une
réécriture d'historique. C'est le seul contrôle de cette liste qui ne se
rattrape pas.

Relire aussi `docs/PLAN.md` : ses exemples JSON contiennent des données
personnelles de Max (CV, téléphone, identité).

Puis :

1. Créer le dépôt **public** `unmaxdinfo` et pousser `main`.
2. Settings → **Code security** : activer *Secret scanning*, *Push
   protection*, *Dependabot alerts*, *Dependabot security updates*, et
   *CodeQL* (Default setup). Tout est gratuit sur un dépôt public.
3. Settings → **Environments** → créer `production`. C'est ce que
   `deploy.yml` référence ; sans lui le job de déploiement ne part pas.
4. Rien à faire pour GHCR : `deploy.yml` s'y authentifie avec le
   `GITHUB_TOKEN` fourni automatiquement. Après le premier déploiement,
   passer les deux paquets (`unmaxdinfo` et `unmaxdinfo-migrate`) en
   **public** — l'image devient alors téléchargeable sans jeton.

> **Conséquence à ne pas oublier** : une image publique est lisible par
> tous. Aucun secret ne doit s'y trouver, ni en `ARG`, ni en couche
> intermédiaire. La CI le vérifie (`trivy --scanners secret`).

---

## 2. Google — se connecter au back-office

**C'est l'étape qui débloque tout le reste** : personne ne peut créer de
compte, la seule porte d'entrée est l'OAuth Google et la liste blanche.

1. [console.cloud.google.com](https://console.cloud.google.com) → créer un
   projet `unmaxdinfo`.
2. **APIs & Services → OAuth consent screen** :
   - Type **External**, statut **Testing** suffit (seuls Max et toi vous
     connectez ; il n'y a pas de vérification à demander).
   - Ajouter vos deux adresses dans **Test users**, sans quoi Google
     refusera la connexion.
   - Portées : `email`, `profile`, `openid`. **Rien d'autre** — le site ne
     lit aucune donnée Google.
3. **Credentials → Create credentials → OAuth client ID**, type
   **Web application**.
4. **Authorized redirect URIs** — au caractère près, les deux :
   ```
   https://unmaxdinfo.fr/api/auth/google
   http://localhost:8000/api/auth/google
   ```
   Google n'accepte le `http://` que sur `localhost` ou `127.0.0.1`
   **nus**. Un sous-domaine comme `unmaxdinfo.localhost` est refusé par la
   console, avec deux messages qui n'expliquent pas la vraie règle :
   « l'URI doit se terminer par une extension de domaine public » et
   « vous devez utiliser un principal domaine privé valide ». C'est pour
   cela que l'hôte de développement est `localhost` et non
   `unmaxdinfo.localhost`.
5. Copier l'identifiant et le secret.

**Dans GitHub** (environnement `production`) **et** en local (`.env.dev`) :

```dotenv
NUXT_OAUTH_GOOGLE_CLIENT_ID=…apps.googleusercontent.com
NUXT_OAUTH_GOOGLE_CLIENT_SECRET=…
NUXT_OAUTH_GOOGLE_REDIRECT_URL=https://unmaxdinfo.fr/api/auth/google
NUXT_BOOTSTRAP_TECH_EMAIL=ton.adresse@exemple.fr
```

`NUXT_BOOTSTRAP_TECH_EMAIL` est **le seul moyen d'obtenir un premier
compte** : au démarrage, cette adresse est inscrite en base avec le rôle
`tech`. Tu crées ensuite celui de Max depuis l'écran Technique.

> Si tu te connectes et retombes sur la page de connexion : c'est presque
> toujours que l'adresse Google ne correspond pas à
> `NUXT_BOOTSTRAP_TECH_EMAIL`, ou que le compte n'est pas dans *Test users*.

---

## 3. Cloudflare R2 — les images

Sans R2, aucun téléversement : ni couverture d'article, ni photo de CV, ni
PDF. L'interface le dit explicitement plutôt que d'échouer en silence.

1. Dashboard Cloudflare → **R2** → *Create bucket*, nom
   `unmaxdinfo-media`, région automatique.
2. **Settings du bucket → Public access** → *Connect a custom domain* :
   `media.unmaxdinfo.fr`. Cloudflare crée l'enregistrement DNS tout seul si
   le domaine y est déjà (étape 5).
3. **R2 → Manage API tokens** → *Create API token* :
   - Permission **Object Read & Write**
   - Restreint au seul bucket `unmaxdinfo-media`
   - Noter *Access Key ID*, *Secret Access Key* et l'**Account ID**
     (visible en haut à droite du dashboard R2).

```dotenv
NUXT_R2_ACCOUNT_ID=<account id>
NUXT_R2_ACCESS_KEY_ID=<access key id>
NUXT_R2_SECRET_ACCESS_KEY=<secret access key>
NUXT_R2_BUCKET=unmaxdinfo-media
NUXT_R2_ENDPOINT=https://<account id>.r2.cloudflarestorage.com
NUXT_PUBLIC_R2_BASE_URL=https://media.unmaxdinfo.fr
```

L'`ENDPOINT` sert à **signer** le téléversement ; la `BASE_URL` est ce que
lit le navigateur. Ce sont deux domaines différents, c'est normal.

> **CORS — obligatoire, et invisible si on l'oublie.** Le navigateur envoie
> le fichier *directement* à R2, pas au serveur. Sans règle CORS sur le
> bucket, le préflight `OPTIONS` revient sans en-tête et le téléversement
> échoue sur un `Failed to fetch` sans code de statut, sans rien dans les
> journaux du serveur. La règle est versionnée, pas à recopier à la main :
>
> ```bash
> NUXT_R2_ENDPOINT=… NUXT_R2_ACCESS_KEY_ID=… \
> NUXT_R2_SECRET_ACCESS_KEY=… NUXT_R2_BUCKET=… pnpm r2:cors
> ```
>
> Le script écrit la règle, **relit** la configuration du bucket et affiche
> ce qu'elle contient vraiment.

---

## 4. Meta — découvrir les publications Instagram

**Rappel de cadrage** : le site ne publie **jamais**. Il lit les
publications de @unmaxdinfo\_ pour les afficher et aider Max à rédiger.
C'est la seule permission demandée.

Le compte doit être en **Professionnel** (Créateur ou Entreprise) — il
l'est déjà. Depuis juillet 2024, l'*Instagram API with Instagram Login*
n'exige plus de page Facebook.

1. [developers.facebook.com](https://developers.facebook.com) → *My Apps* →
   **Create App** → cas d'usage **Other** → type **Business**.
2. Ajouter le produit **Instagram** → *API setup with Instagram login*.
3. Relever **Instagram App ID** et **Instagram App Secret**.
4. Dans *Business login settings*, **OAuth Redirect URI**, exactement :
   ```
   https://unmaxdinfo.fr/api/admin/instagram/callback
   ```
5. Ajouter @unmaxdinfo\_ comme testeur Instagram, et accepter l'invitation
   depuis le compte (Paramètres → Applications et sites web).
6. **App settings → Basic**, les trois URL que la console réclame pour
   basculer l'app en *Live* :

   | Champ | Valeur |
   |---|---|
   | Privacy Policy URL | `https://unmaxdinfo.fr/privacy` |
   | User data deletion | `https://unmaxdinfo.fr/privacy#data-deletion` |
   | Terms of Service URL | `https://unmaxdinfo.fr/terms` |

   Les pages doivent être **en ligne avant** de remplir le formulaire : Meta
   les charge pour vérifier qu'elles répondent. L'ancre `#data-deletion` est
   tenue par `test/api/legal-pages.spec.ts` — la renommer en passant
   invaliderait une déclaration faite à Meta sans que rien n'ait l'air cassé.

```dotenv
NUXT_INSTAGRAM_APP_ID=<instagram app id>
NUXT_INSTAGRAM_APP_SECRET=<instagram app secret>
NUXT_INSTAGRAM_SYNC_INTERVAL_MINUTES=60
NUXT_SCHEDULER_ENABLED=true
```

Le **jeton ne se met pas dans le `.env`** : il s'obtient depuis le site.
Rédaction → **Réseaux** → *Connecter un compte*. Le jeton revient
d'Instagram, est échangé contre un jeton de 60 jours, puis chiffré en base
(AES-256-GCM) sous une clé propre au compte. L'écran affiche son âge et
alerte avant l'expiration.

L'opération se répète pour **chaque compte** à afficher : chacun aura sa
section sur l'accueil, dans l'ordre et au nombre de publications réglés
depuis ce même écran.

> `NUXT_SCHEDULER_ENABLED=true` sur **une seule** instance. Le
> dédoublonnage des tâches Nitro est *par instance* : deux répliques à
> `true` synchroniseraient deux fois.

---

## 5. Domaine et DNS

1. Chez **Infomaniak**, pointer les serveurs de noms de `unmaxdinfo.fr`
   vers ceux que **Cloudflare** indique à l'ajout du domaine.
2. Dans Cloudflare → DNS :

   | Type | Nom | Valeur | Proxy |
   |---|---|---|---|
   | `A` | `@` | IP du VPS | activé |
   | `CNAME` | `www` | `unmaxdinfo.fr` | activé |
   | *(auto)* | `media` | créé par R2 à l'étape 3 | activé |

3. SSL/TLS → mode **Full (strict)**. En *Flexible*, Cloudflare parlerait au
   VPS en clair et le cookie de session, qui est `Secure`, ne serait jamais
   posé : connexion impossible, sans message.

---

## 6. Le VPS et le déploiement

### Sur le serveur, une fois

Le projet ne déploie **aucun** Traefik : il rejoint celui qui existe déjà.

```bash
# Le réseau du Traefik en place, au nom LITTÉRAL (aucun préfixe de projet)
docker network ls | grep reverse_proxy   # doit exister

mkdir -p /srv/unmaxdinfo
```

C'est tout. **Aucun fichier à écrire à la main** : le `.env` est fabriqué
par GitHub Actions et copié en `0600` à chaque déploiement.

Il reste à autoriser la clé de déploiement :

```bash
# La clé PUBLIQUE de la paire dédiée au déploiement, et elle seule.
cat >> ~/.ssh/authorized_keys
```

### Secrets GitHub

Settings → Secrets and variables → **Actions** :

Tout se pose dans l'environnement **`production`**. Un *secret* n'est jamais
relisible ni affiché dans les journaux ; une *variable* l'est : ne mettre en
variable que ce qui peut être public.

**Secrets — atteindre le VPS**

| Secret | Valeur |
|---|---|
| `DEPLOY_HOST` | IP ou nom du VPS |
| `DEPLOY_USER` | l'utilisateur SSH |
| `DEPLOY_SSH_KEY` | la **clé privée** d'une paire dédiée au déploiement |
| `DEPLOY_PATH` | `/srv/unmaxdinfo` |

**Secrets — faire tourner le site**

| Secret | Comment l'obtenir |
|---|---|
| `POSTGRES_PASSWORD` | `openssl rand -hex 24` |
| `NUXT_SECRET_ENCRYPTION_KEY` | `openssl rand -base64 32` |
| `NUXT_SESSION_PASSWORD` | `openssl rand -hex 32` |
| `NUXT_OAUTH_GOOGLE_CLIENT_SECRET` | console Google, étape 2 |
| `NUXT_R2_ACCOUNT_ID`, `NUXT_R2_ACCESS_KEY_ID`, `NUXT_R2_SECRET_ACCESS_KEY` | Cloudflare R2, étape 3 |
| `NUXT_INSTAGRAM_APP_SECRET` | Meta, étape 4 |

**Variables**

`DEPLOY_SSH_PORT`, `URL_HOST`, `POSTGRES_DB`, `POSTGRES_USER`, `DB_HOST`,
`DB_PORT`, `NUXT_OAUTH_GOOGLE_CLIENT_ID`, `NUXT_OAUTH_GOOGLE_REDIRECT_URL`,
`NUXT_BOOTSTRAP_TECH_EMAIL`, `NUXT_R2_BUCKET`, `NUXT_R2_ENDPOINT`,
`NUXT_INSTAGRAM_APP_ID`, `NUXT_INSTAGRAM_SYNC_INTERVAL_MINUTES`,
`NUXT_SCHEDULER_ENABLED`, `NUXT_PUBLIC_R2_BASE_URL`.

Celles qui ont une valeur évidente ont une valeur par défaut dans le
workflow : seules `NUXT_OAUTH_GOOGLE_*`, `NUXT_BOOTSTRAP_TECH_EMAIL`,
`NUXT_R2_*` et `NUXT_PUBLIC_R2_BASE_URL` sont réellement à poser.
`DEPLOY_SSH_PORT` vaut `22` tant qu'on ne la pose pas : elle n'est à définir
que si le démon SSH du VPS écoute ailleurs.

Le déploiement **échoue avant de toucher au serveur** si l'une des valeurs
obligatoires manque, en la nommant. Mieux vaut un déploiement refusé qu'un
conteneur `app` qui redémarre en boucle.

> ### Deux pièges qui ne préviennent pas
>
> **Un secret GitHub ne se relit pas.** `NUXT_SECRET_ENCRYPTION_KEY` chiffre
> le jeton Instagram stocké en base : la perdre, ce n'est pas perdre le
> site, c'est perdre le jeton — il faudra refaire la connexion Instagram.
> La changer a le même effet. En garder une copie dans un gestionnaire de
> mots de passe est **obligatoire**, puisque GitHub ne la redonnera pas.
>
> **Changer `POSTGRES_PASSWORD` ne change pas le mot de passe de la base.**
> Postgres ne lit cette variable qu'au tout premier démarrage, quand il crée
> son volume. Ensuite, modifier le secret GitHub ne fait que désaccorder
> l'application et la base. Pour une rotation réelle : `ALTER USER
> unmaxdinfo WITH PASSWORD '…'` dans le conteneur `db`, **puis** le secret.

Créer une paire dédiée, jamais ta clé personnelle :

```bash
ssh-keygen -t ed25519 -f ~/.ssh/unmaxdinfo_deploy -C 'deploy unmaxdinfo' -N ''
ssh-copy-id -i ~/.ssh/unmaxdinfo_deploy.pub <user>@<host>   # -p <port> si ce n'est pas 22
cat ~/.ssh/unmaxdinfo_deploy          # → DEPLOY_SSH_KEY
```

### Ce que fait le déploiement

Un push sur `main` déclenche `deploy.yml`, qui :

1. **attend la CI** — un commit qui casse les tests ne part pas ;
2. construit et publie les deux images sur GHCR ;
3. rend `docker-compose.yml` et **vérifie qu'il ne contient aucun secret** ;
4. le copie sur le VPS ;
5. `docker compose run --rm migrate && docker compose up -d --wait`.

Le `&&` de l'étape 5 est toute la garantie : **migration en échec = aucune
bascule**, l'ancienne image continue de servir.

---

## 7. Le premier passage, dans l'ordre

```bash
git push origin main                      # déclenche CI puis déploiement
curl -fsS https://unmaxdinfo.fr/api/health        # → {"status":"ok",…}
curl -fsS https://unmaxdinfo.fr/api/health/ready  # → database: ok
```

Puis, dans le navigateur :

1. `https://unmaxdinfo.fr/login` → se connecter avec l'adresse de
   `NUXT_BOOTSTRAP_TECH_EMAIL`.
2. **Réseaux** → *Connecter un compte*, puis *Tout synchroniser*.
3. **Technique** → créer le compte de Max avec le rôle `editor`, et lui
   demander de se connecter une fois.
4. **À propos** → téléverser la photo et le CV en PDF (vérifie R2).
5. Rapatrier les couvertures Substack, sans rien écrire d'abord :
   ```bash
   pnpm substack https://unmaxdinfo.substack.com/feed --dry
   pnpm substack https://unmaxdinfo.substack.com/feed
   ```
6. **Technique** → *Télécharger une sauvegarde*, et vérifier que l'archive
   s'ouvre.

---

## Si ça ne marche pas

| Symptôme | Cause presque toujours |
|---|---|
| Le conteneur `app` redémarre en boucle | Un secret obligatoire manque. `docker compose logs app` **nomme la variable**. |
| Connexion Google → retour à `/login` | Adresse absente de la liste blanche, ou hors des *Test users*. |
| `redirect_uri_mismatch` | L'URI déclarée chez Google diffère d'un caractère. Elle inclut le schéma, le port et le chemin. |
| Téléversement : « Failed to fetch », sans statut | La règle CORS du bucket n'autorise pas l'origine du site. Lancer `pnpm r2:cors`. |
| Instagram : « le jeton ne se rafraîchit plus » | Passé 60 jours, il est mort. Refaire *Connecter un compte* pour le même compte : il retombe sur sa ligne, ordre et réglages préservés. |
| Cookie de session jamais posé | SSL en *Flexible* chez Cloudflare, ou site servi en clair. |
| Le déploiement ne part pas | L'environnement `production` n'existe pas dans les Settings du dépôt. |
