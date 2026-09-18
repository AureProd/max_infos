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

import { definePreset } from '@primevue/themes'
import Aura from '@primevue/themes/aura'
import tailwindcss from '@tailwindcss/vite'
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
      include: [
        'DataTable',
        'Column',
        'Tag',
        'Select',
        'InputText',
        'InputNumber',
        'Button',
        'ToggleSwitch',
        'Dialog',
        'Checkbox',
        // Les onglets de l'écran À propos. Absents d'ici, ils ne sont PAS
        // auto-importés : l'écran rend du vide, sans message — et
        // scripts/hooks/vue-templates.mjs ne le voit pas non plus, puisqu'il
        // lit node_modules/primevue et non cette liste.
        'Tabs',
        'TabList',
        'Tab',
        'TabPanels',
        'TabPanel',
        // Le retour à l'utilisateur, jusqu'ici absent : six machines d'état
        // « repos / enregistré / échec » recopiées d'un écran à l'autre, et
        // sept window.confirm().
        'Toast',
        'ConfirmDialog',
        'ConfirmPopup',
        'Message',
        // Les écrans repensés : graphiques du tableau de bord, rubriques
        // repliables du CV, recherche à icône, texte long.
        'Chart',
        'Accordion',
        'AccordionPanel',
        'AccordionHeader',
        'AccordionContent',
        'IconField',
        'InputIcon',
        'Textarea',
      ],
    },
    // `Tooltip` est une DIRECTIVE, pas un composant : rangée dans
    // `components.include`, elle n'est jamais enregistrée et `v-tooltip`
    // ne fait rien — sans message.
    directives: {
      include: ['Tooltip'],
    },
    options: {
      theme: {
        preset: definePreset(Aura, {
          semantic: {
            /*
             * Aura's `primary` is EMERALD. Every Button without a severity
             * came out green — « Inviter », « Rattacher », « Fermer » — in a
             * back-office whose every other action is the logo blue, and so
             * did a checked ToggleSwitch and the active tab. It is a default
             * of the library, so nothing in this repository said it.
             *
             * The ramp is anchored on the two blues of the @theme block:
             * `--color-accent` at 500 and `--color-accent-strong` at 600 —
             * the accent measured on Max's Substack.
             * Tenu par test/unit/admin-styles.spec.ts.
             */
            primary: {
              50: '#eff5ff',
              100: '#e8effd',
              200: '#bed2fa',
              300: '#93b4f7',
              400: '#5d8ef2',
              500: '#2563eb',
              600: '#1555e2',
              700: '#1544b4',
              800: '#163a91',
              900: '#173575',
              950: '#102147',
            },
          },
        }),
        options: {
          // Le back-office est en clair. Sans sélecteur, PrimeVue suivrait
          // prefers-color-scheme et repeindrait l'administration selon le
          // réglage du système.
          darkModeSelector: '.primevue-dark',
          // C'est PrimeVue qui ÉCRIT l'instruction `@layer …;` — d'où
          // l'ordre complet ici, couches de Tailwind comprises. `site`
          // porte base.css et admin.css : après `primevue`, qu'elles
          // surchargent, avant `utilities`, qui les surcharge.
          cssLayer: {
            name: 'primevue',
            order: 'theme, base, primevue, site, components, utilities',
          },
        },
      },
      ripple: false,
    },
  },

  // The entry sheet: layer order, Tailwind, the @theme palette, then
  // base.css. Loaded globally, and excluded from the formatter (biome.jsonc).
  css: ['~/assets/css/main.css'],

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
          href: 'https://fonts.googleapis.com/css2?family=Gabarito:wght@700..900&family=Lexend:wght@300..700&display=swap',
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
    /*
     * Les en-têtes de sécurité, sur TOUTE la réponse.
     *
     * Ils vivaient chez Cloudflare, dont le proxy ne s'exécute plus depuis
     * le passage de `@` et `www` en *DNS only* — décision consignée dans
     * `CLAUDE.md`, prise parce que le défi ACME TLS-ALPN-01 ne traverse pas
     * un proxy. Personne ne les a repris : la réponse n'en portait plus
     * aucun, mesuré.
     *
     * Ici et non dans les labels Traefik : ils valent aussi en
     * développement, où il n'y a pas de proxy. Et sur `/**` plutôt qu'écran
     * par écran, parce qu'une règle par écran est une règle qu'on oublie
     * sur le suivant.
     *
     * `frame-ancestors` est la seule directive de CSP posée : une politique
     * complète demanderait des nonces sur les scripts que Nuxt inline, et
     * une CSP à moitié écrite ne protège de rien tout en cassant des pages.
     */
    '/**': {
      headers: {
        'content-security-policy': "frame-ancestors 'none'",
        'x-frame-options': 'DENY',
        'x-content-type-options': 'nosniff',
        'referrer-policy': 'strict-origin-when-cross-origin',
      },
    },
    '/': { swr: 300 },
    '/article/**': { swr: 600 },
    '/about': { swr: 3600 },
    '/privacy': { swr: 86400 },
    '/legal': { swr: 86400 },
    '/terms': { swr: 86400 },
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
    // Tailwind v4 n'a plus de fichier de configuration : il lit le bloc
    // `@theme` de app/assets/css/main.css. Le plugin doit vivre DANS cette
    // clé et pas dans une seconde `vite:` — un objet en double n'est pas
    // fusionné, il écrase, et Tailwind ne tourne alors jamais : le
    // `@tailwind utilities` part tel quel dans la feuille servie.
    plugins: [tailwindcss()],

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
