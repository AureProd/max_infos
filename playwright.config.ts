import { defineConfig, devices } from '@playwright/test'
import { E2E_DATABASE_URL } from './test/e2e/helpers'

/**
 * The browser tests.
 *
 * Vitest proves what the server SENDS; nothing until now proved what the
 * browser SHOWS. The whole point of this suite is the thing `pnpm test`
 * cannot reach: layout. A screen that overflows sideways on a phone, a
 * button that leaves the viewport, a font that never loads — the HTML is
 * correct in every one of those cases.
 *
 * Hence three widths rather than three browsers. The risk this project
 * carries is a broken layout, not a Safari quirk.
 */
const WIDTHS = {
  phone: { width: 390, height: 844 },
  tablet: { width: 820, height: 1180 },
  desk: { width: 1440, height: 900 },
} as const

const PORT = Number(process.env.E2E_PORT ?? 3210)
const BASE = `http://127.0.0.1:${PORT}`

export default defineConfig({
  testDir: './test/e2e',
  // A layout assertion that needs a retry is an assertion that measures
  // something else. Better to see it fail.
  retries: 0,
  fullyParallel: true,
  reporter: process.env.CI ? [['github'], ['list']] : [['list']],
  globalSetup: './test/e2e/prepare.ts',

  use: {
    baseURL: BASE,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },

  projects: [
    // Opens the back-office session once, and hands the cookie to the
    // screens that need one.
    { name: 'signin', testMatch: /signin\.setup\.ts$/ },
    ...Object.entries(WIDTHS).map(([name, viewport]) => ({
      name,
      use: { ...devices['Desktop Chrome'], viewport },
      dependencies: ['signin'],
    })),
  ],

  webServer: {
    // The BUILT server, not `nuxt dev`: the dev server serves unbundled CSS
    // and its own layer order, which is precisely what these tests check.
    // `pnpm build:e2e` must have run — `pnpm verify` chains the two.
    command: 'node .output/server/index.mjs',
    url: BASE,
    reuseExistingServer: !process.env.CI,
    stdout: 'pipe',
    stderr: 'pipe',
    env: {
      NUXT_DATABASE_URL: E2E_DATABASE_URL,
      NUXT_SESSION_PASSWORD: 'mot-de-passe-de-session-pour-les-tests-32c',
      // A `Secure` cookie is DROPPED by the browser over http://127.0.0.1 —
      // silently. The session would never be stored, every admin screen
      // would redirect to the sign-in page, and nothing would say why.
      NUXT_SESSION_COOKIE_SECURE: 'false',
      // Dummy R2 credentials: signing a URL is local computation. They let
      // the upload screens render without a bucket.
      NUXT_R2_ENDPOINT: 'https://exemple.r2.cloudflarestorage.com',
      NUXT_R2_ACCESS_KEY_ID: 'cle-de-test',
      NUXT_R2_SECRET_ACCESS_KEY: 'secret-de-test',
      NUXT_R2_BUCKET: 'unmaxdinfo-test',
      NUXT_PUBLIC_R2_BASE_URL: 'https://media.exemple.test',
      NUXT_PUBLIC_APP_ENV: 'dev',
      PORT: String(PORT),
      HOST: '127.0.0.1',
    },
  },
})
