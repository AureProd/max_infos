// Configuration Nuxt. Voir docs/PLAN.md pour le contexte du projet.
//
// Deux règles à ne pas perdre de vue dans ce fichier :
//   1. Ce qui est lu ici par `process.env` est FIGÉ AU BUILD. Les valeurs qui
//      doivent varier à l'exécution passent par `runtimeConfig` et les
//      variables d'environnement préfixées `NUXT_`, injectées au démarrage.
//      C'est ce qui évite qu'une image construite en CI embarque les
//      variables du runner GitHub.
//   2. Les seules exceptions sont les réglages du serveur de développement
//      ci-dessous : ils ne servent qu'en dev, où il n'y a pas de build.

// La version est une constante de BUILD, contrairement aux secrets : la
// figer dans l'image est exactement ce qu'on veut, pour que /api/health
// dise quelle image tourne.
import { version } from './package.json'

const urlHost = process.env.URL_HOST ?? 'unmaxdinfo.localhost'
const urlPort = Number(process.env.URL_PORT ?? 8080)

export default defineNuxtConfig({
  compatibilityDate: '2026-09-14',
  devtools: { enabled: true },

  // nuxt-auth-utils fournit la session scellée en cookie et le flux OAuth
  // Google. Il remplace ce que faisaient authlib et itsdangerous côté
  // Python, en moins de code.
  modules: ['nuxt-auth-utils'],

  // Le design entier vit dans ce fichier. Il est chargé globalement, comme
  // avant, et exclu du formateur (voir biome.json).
  css: ['~/assets/css/base.css'],

  app: {
    head: {
      htmlAttrs: { lang: 'fr' },
      link: [
        { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
        { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' },
        {
          rel: 'stylesheet',
          href: 'https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,400;12..96,500;12..96,600;12..96,700&family=Newsreader:ital,opsz,wght@0,6..72,300;0,6..72,400;0,6..72,500;0,6..72,600;1,6..72,400&display=swap',
        },
      ],
    },
  },

  typescript: {
    strict: true,
    // Le typage est une étape à part (`pnpm typecheck`) : le laisser dans le
    // build ralentirait chaque rechargement à chaud sans rien apporter.
    typeCheck: false,
  },

  nitro: {
    preset: 'node-server',
    compressPublicAssets: true,
    // server/api/test/ contient une route qui ouvre une session sans preuve
    // d'identité, pour le test d'autorisations. Elle n'entre dans le bundle
    // que si on le demande EXPLICITEMENT au moment du build. Par défaut,
    // elle n'existe pas dans l'image — pas même désactivée : absente.
    ignore: process.env.NUXT_TEST_ROUTES === 'true' ? [] : ['api/test/**'],
  },

  // Valeurs par défaut VIDES, jamais factices : rien ne peut tourner en
  // production avec un secret de démonstration. La validation qui refuse le
  // démarrage vit dans server/plugins/00.config.ts.
  //
  // Clés à plat, et non imbriquées : le découpage des `_` d'une variable
  // d'environnement en clés imbriquées dépend de la forme déclarée ici et
  // devient vite piégeux. `NUXT_GOOGLE_CLIENT_ID` alimente `googleClientId`.
  runtimeConfig: {
    databaseUrl: '',
    // Lu par nuxt-auth-utils pour sceller le cookie de session. Il impose
    // ce chemin exact (runtimeConfig.session.password) et un minimum de
    // 32 caractères.
    session: {
      name: 'umdi_session',
      password: '',
      cookie: { sameSite: 'lax', httpOnly: true, secure: true, path: '/' },
      maxAge: 60 * 60 * 24 * 14,
    },
    // Chemin imposé par nuxt-auth-utils, alimenté par
    // NUXT_OAUTH_GOOGLE_CLIENT_ID et NUXT_OAUTH_GOOGLE_CLIENT_SECRET.
    // On ne double PAS ces clés ailleurs : deux noms pour un même secret,
    // c'est la garantie qu'un jour l'un des deux sera renseigné et pas
    // l'autre, avec un message d'erreur qui ne dira pas lequel.
    oauth: {
      google: { clientId: '', clientSecret: '', redirectURL: '' },
    },
    secretEncryptionKey: '',
    sessionSecret: '',
    sessionCookieName: 'umdi_session',
    sessionMaxAge: 1_209_600,
    bootstrapTechEmail: '',
    r2AccountId: '',
    r2AccessKeyId: '',
    r2SecretAccessKey: '',
    r2Bucket: '',
    r2Endpoint: '',
    instagramAppId: '',
    instagramAppSecret: '',
    instagramSyncIntervalMinutes: 60,
    // Les tâches planifiées ne tournent que là où cette valeur est vraie.
    // Le dédoublonnage de Nitro est PAR INSTANCE : sans cet interrupteur,
    // deux répliques synchroniseraient Instagram deux fois.
    schedulerEnabled: false,
    // `public` est le seul bloc qui part au navigateur.
    public: {
      version,
      appEnv: 'dev',
      baseUrl: 'http://unmaxdinfo.localhost:8080',
      r2BaseUrl: '',
    },
  },

  devServer: {
    // Sans 0.0.0.0, nuxi n'écoute que la boucle locale DU CONTENEUR et
    // Traefik ne l'atteint jamais.
    host: '0.0.0.0',
    port: 3000,
  },

  vite: {
    server: {
      // Vite autorise déjà `localhost` et les domaines en `.localhost`.
      // Explicite quand même, pour le jour où URL_HOST devient un vrai
      // domaine de préproduction.
      allowedHosts: [urlHost],
      // Vite 8 : server.hmr.* est déprécié au profit de server.ws.*.
      //
      // Un seul réglage est nécessaire, et c'est le seul qui compte :
      // clientPort. Le navigateur compose l'URL du WebSocket avec le port
      // qu'on lui donne ici ; sans lui il viserait le 3000 du conteneur,
      // injoignable depuis l'hôte.
      //
      // Contrairement à ce qu'on pourrait croire, Nuxt 4 n'ouvre PAS de
      // serveur WebSocket séparé pour le client : celui-ci est porté par le
      // serveur principal, sur /_nuxt/_nuxt_hmr. Le routeur Traefik de
      // l'application le couvre donc déjà, et aucun routeur dédié n'est
      // nécessaire. Vérifié avec un vrai client WebSocket — curl n'en est
      // pas un et renvoie 400 même quand tout fonctionne.
      ws: {
        protocol: 'ws',
        // `host` volontairement absent : le client retombe sur l'hôte de la
        // page. Le figer casserait les clones servis sur un autre nom.
        clientPort: urlPort,
      },
    },
  },
})
