import { defineVitestConfig } from '@nuxt/test-utils/config'

// Trois projets, pour ne pas payer l'environnement Nuxt (lourd) sur les tests
// de shared/ et server/utils/, qui sont les plus nombreux et les plus rapides.
export default defineVitestConfig({
  test: {
    projects: [
      {
        test: {
          name: 'unit',
          environment: 'node',
          include: ['test/unit/**/*.spec.ts'],
        },
      },
      {
        test: {
          name: 'nuxt',
          environment: 'nuxt',
          include: ['test/nuxt/**/*.spec.ts'],
          environmentOptions: { nuxt: { domEnvironment: 'jsdom' } },
        },
      },
      {
        test: {
          name: 'api',
          environment: 'node',
          include: ['test/api/**/*.spec.ts'],
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
      // Les quatre métriques, pas seulement les lignes : un seuil sur les
      // lignes seules se contourne trivialement.
      thresholds: { lines: 80, statements: 80, functions: 80, branches: 80 },
    },
  },
})
