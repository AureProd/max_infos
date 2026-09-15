import { fileURLToPath } from 'node:url'
import { defineVitestProject } from '@nuxt/test-utils/config'
import { defineConfig } from 'vitest/config'

// The « unit » and « api » projects run outside the Nuxt environment:
// Nuxt's aliases (#shared, ~) do not exist there and must be redeclared.
const alias = {
  '#shared': fileURLToPath(new URL('./shared', import.meta.url)),
  '~~': fileURLToPath(new URL('.', import.meta.url)),
}

// Three projects, so as not to pay for the (heavy) Nuxt environment on the
// shared/ and server/utils/ tests, which are the most numerous and the
// fastest. Only the « nuxt » project goes through defineVitestProject.
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
          // The Nitro server started by the tests talks to the throwaway
          // database of the development compose, not to the dev one: the
          // tests write, and must leave nothing behind.
          env: {
            // Enables the test session route, excluded from the bundle otherwise.
            NUXT_TEST_ROUTES: 'true',
            // Dummy R2 credentials: URL signing is local computation, with
            // no network call. They allow testing the upload route without
            // a bucket, and keep the authorization matrix independent of
            // the storage configuration.
            NUXT_R2_ENDPOINT: 'https://exemple.r2.cloudflarestorage.com',
            NUXT_R2_ACCESS_KEY_ID: 'cle-de-test',
            NUXT_R2_SECRET_ACCESS_KEY: 'secret-de-test',
            NUXT_R2_BUCKET: 'unmaxdinfo-test',
            NUXT_PUBLIC_R2_BASE_URL: 'https://media.exemple.test',
            NUXT_SESSION_PASSWORD: 'mot-de-passe-de-session-pour-les-tests-32c',
            NUXT_DATABASE_URL:
              process.env.TEST_DATABASE_URL ??
              'postgres://unmaxdinfo:test@127.0.0.1:15000/unmaxdinfo_test',
          },
          // The database is shared: we avoid contention as long as the
          // suite is small.
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
        // Declarative, run on import: covering it would prove nothing.
        'server/database/schema/**',
        'scripts/**',
      ],
      // All four metrics, not just lines: a threshold on lines alone is
      // trivially worked around.
      thresholds: { lines: 80, statements: 80, functions: 80, branches: 80 },
    },
  },
}))
