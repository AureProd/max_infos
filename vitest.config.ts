import { fileURLToPath } from 'node:url'
import { defineVitestProject } from '@nuxt/test-utils/config'
import { defineConfig } from 'vitest/config'

// Les projets « unit » et « api » tournent hors environnement Nuxt : les
// alias de Nuxt (#shared, ~) n'y existent pas et doivent être redéclarés.
const alias = {
  '#shared': fileURLToPath(new URL('./shared', import.meta.url)),
  '~~': fileURLToPath(new URL('.', import.meta.url)),
}

// Trois projets, pour ne pas payer l'environnement Nuxt (lourd) sur les
// tests de shared/ et server/utils/, qui sont les plus nombreux et les plus
// rapides. Seul le projet « nuxt » passe par defineVitestProject.
export default defineConfig(async () => ({
  test: {
    projects: [
      {
        resolve: { alias },
        test: {
          name: 'unit',
          environment: 'node',
          include: ['test/unit/**/*.spec.ts'],
        },
      },
      await defineVitestProject({
        test: {
          name: 'nuxt',
          environment: 'nuxt',
          include: ['test/nuxt/**/*.spec.ts'],
          environmentOptions: { nuxt: { domEnvironment: 'jsdom' } },
        },
      }),
      {
        resolve: { alias },
        test: {
          name: 'api',
          environment: 'node',
          include: ['test/api/**/*.spec.ts'],
          // Le serveur Nitro lancé par les tests parle à la base jetable du
          // compose de développement, pas à celle de dev : les tests
          // écrivent, et ne doivent rien y laisser.
          env: {
            NUXT_DATABASE_URL:
              process.env.TEST_DATABASE_URL ??
              'postgres://unmaxdinfo:test@127.0.0.1:15432/unmaxdinfo_test', // pragma: allowlist secret
          },
          // La base est partagée : on évite la contention tant que la suite
          // est petite.
          fileParallelism: false,
          hookTimeout: 30_000,
        },
      },
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'json-summary'],
      include: ['app/**', 'server/**', 'shared/**'],
      exclude: [
        '**/*.d.ts',
        'app/app.vue',
        // Déclaratif, exécuté à l'import : le couvrir ne prouverait rien.
        'server/database/schema/**',
        'scripts/**',
      ],
      // Les quatre métriques, et pas seulement les lignes : un seuil sur les
      // lignes seules se contourne trivialement.
      thresholds: { lines: 80, statements: 80, functions: 80, branches: 80 },
    },
  },
}))
