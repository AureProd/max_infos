// Nuxt configuration. See docs/PLAN.md for the project context.
//
// Two rules to keep in mind in this file:
//   1. Whatever is read here through `process.env` is FROZEN AT BUILD TIME.
//      Values that must vary at runtime go through `runtimeConfig` and
//      `NUXT_`-prefixed environment variables, injected at startup. That is
//      what keeps an image built in CI from embedding the GitHub runner's
//      variables.
//   2. The only exceptions are the development server settings below: they
//      only serve dev, where there is no build.

import Aura from '@primevue/themes/aura'
// The version is a BUILD constant, unlike the secrets: freezing it into
// the image is exactly what we want, so that /api/health says which image
// is running.
import { version } from './package.json'

const urlHost = process.env.URL_HOST ?? 'localhost'
const urlPort = Number(process.env.URL_PORT ?? 8000)

export default defineNuxtConfig({
  compatibilityDate: '2026-09-14',
  devtools: { enabled: true },

  // nuxt-auth-utils provides the cookie-sealed session and the Google OAuth
  // flow. It replaces what authlib and itsdangerous did on the Python side,
  // in less code.
  modules: ['nuxt-auth-utils', '@primevue/nuxt-module'],

  /**
   * PrimeVue habille les LISTES du back-office, et rien d'autre.
   *
   * Version 4, sous licence MIT : la 5 affiche un avertissement de licence
   * dans la console. Le site public n'en charge rien — il ne doit pas
   * ressembler à un tableau de bord.
   */
  primevue: {
    // Auto-import limité : sans cela le module enregistre les ~80 composants
    // de la bibliothèque, et chacun entre dans le paquet.
    components: {
      include: ['DataTable', 'Column', 'Tag', 'Select', 'InputText', 'Button', 'ToggleSwitch'],
    },
    options: {
      theme: {
        preset: Aura,
        options: {
          // Le back-office est en clair. Sans sélecteur, PrimeVue suivrait
          // prefers-color-scheme et repeindrait l'administration selon le
          // réglage du système.
          darkModeSelector: '.primevue-dark',
          cssLayer: { name: 'primevue', order: 'primevue, theme, base' },
        },
      },
      ripple: false,
    },
  },

  // The whole design lives in this file. It is loaded globally, as before,
  // and excluded from the formatter (see biome.jsonc).
  css: ['~/assets/css/base.css'],

  app: {
    head: {
      htmlAttrs: { lang: 'fr' },
      link: [
        // An SVG icon, and an SVG icon only, for anything modern: one file,
        // sharp at every size, no 16/32/48 set to keep in step. The .ico is
        // not provided on purpose — a browser that cannot read the SVG falls
        // back to asking for /favicon.ico and simply gets a 404, which costs
        // one request and breaks nothing.
        { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' },
        // iOS refuses SVG here, and applies its own rounded mask: the PNG is
        // deliberately square, edge to edge.
        { rel: 'apple-touch-icon', href: '/apple-touch-icon.png' },
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
    // Type checking is a separate step (`pnpm typecheck`): leaving it in
    // the build would slow every hot reload for nothing.
    typeCheck: false,
  },

  /**
   * Server-side render cache.
   *
   * `swr` serves the last rendered version while preparing a new one. Two
   * gains: the public pages do not redo their queries for every visitor,
   * and — this is the important part — a momentarily unavailable database no
   * longer brings the site down, as it keeps serving what it has cached.
   *
   * The back-office and the API are excluded: Max must see his changes
   * straight away, and a cached API response would lie about the real
   * state.
   */
  routeRules: {
    '/': { swr: 300 },
    '/article/**': { swr: 600 },
    '/about': { swr: 3600 },
    '/publication/**': { swr: 600 },
    '/rss.xml': { swr: 900 },
    '/sitemap.xml': { swr: 3600 },
    // An HTTP header rather than a tag: a robot that does not run
    // JavaScript, or that fetches a non-HTML response, still sees it.
    '/admin/**': { swr: false, headers: { 'x-robots-tag': 'noindex, nofollow' } },
    '/login': { swr: false, headers: { 'x-robots-tag': 'noindex, nofollow' } },
    '/api/**': { swr: false },
  },

  nitro: {
    preset: 'node-server',
    compressPublicAssets: true,
    // server/api/test/ holds a route that opens a session without proof of
    // identity, for the authorization test. It only enters the bundle if
    // EXPLICITLY asked for at build time. By default it does not exist in
    // the image — not even disabled: absent.
    ignore: process.env.NUXT_TEST_ROUTES === 'true' ? [] : ['api/test/**'],
  },

  // EMPTY defaults, never dummy ones: nothing can run in production on a
  // demonstration secret. The validation that refuses startup lives in
  // server/plugins/00.config.ts.
  //
  // Flat keys, not nested ones: how the `_` of an environment variable are
  // split into nested keys depends on the shape declared here and quickly
  // becomes treacherous. `NUXT_GOOGLE_CLIENT_ID` feeds `googleClientId`.
  runtimeConfig: {
    databaseUrl: '',
    // Read by nuxt-auth-utils to seal the session cookie. It mandates this
    // exact path (runtimeConfig.session.password) and at least 32
    // characters.
    session: {
      name: 'umdi_session',
      password: '',
      cookie: { sameSite: 'lax', httpOnly: true, secure: true, path: '/' },
      maxAge: 60 * 60 * 24 * 14,
    },
    // Path mandated by nuxt-auth-utils, fed by
    // NUXT_OAUTH_GOOGLE_CLIENT_ID and NUXT_OAUTH_GOOGLE_CLIENT_SECRET.
    // We do NOT mirror these keys elsewhere: two names for one secret is a
    // guarantee that one day one of the two will be set and not the other,
    // with an error message that will not say which.
    oauth: {
      google: { clientId: '', clientSecret: '', redirectURL: '' },
    },
    secretEncryptionKey: '',
    bootstrapTechEmail: '',
    r2AccountId: '',
    r2AccessKeyId: '',
    r2SecretAccessKey: '',
    r2Bucket: '',
    r2Endpoint: '',
    instagramAppId: '',
    instagramAppSecret: '',
    instagramSyncIntervalMinutes: 60,
    // Scheduled tasks only run where this value is true. Nitro deduplicates
    // PER INSTANCE: without this switch, two replicas would sync Instagram
    // twice.
    schedulerEnabled: false,
    // `public` is the only block that travels to the browser.
    public: {
      version,
      appEnv: 'dev',
      baseUrl: 'http://localhost:8000',
      r2BaseUrl: '',
    },
  },

  devServer: {
    // Without 0.0.0.0, nuxi only listens on the CONTAINER's loopback and
    // Traefik never reaches it.
    host: '0.0.0.0',
    port: 3000,
  },

  vite: {
    server: {
      // Vite already allows `localhost` and `.localhost` domains. Explicit
      // anyway, for the day URL_HOST becomes a real staging domain.
      allowedHosts: [urlHost],
      // Vite 8: server.hmr.* is deprecated in favour of server.ws.*.
      //
      // A single setting is needed, and it is the only one that counts:
      // clientPort. The browser composes the WebSocket URL with the port
      // given here; without it, it would aim at the container's 3000,
      // unreachable from the host.
      //
      // Contrary to what one might think, Nuxt 4 does NOT open a separate
      // WebSocket server for the client: it is carried by the main server,
      // on /_nuxt/_nuxt_hmr. The application's Traefik router therefore
      // already covers it, and no dedicated router is needed. Verified with
      // a real WebSocket client — curl is not one and returns 400 even when
      // everything works.
      ws: {
        protocol: 'ws',
        // `host` deliberately absent: the client falls back to the page's
        // host. Freezing it would break clones served under another name.
        clientPort: urlPort,
      },
    },
  },
})
