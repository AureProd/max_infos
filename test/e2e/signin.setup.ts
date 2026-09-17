import { readFileSync } from 'node:fs'
import { expect, test as setup } from '@playwright/test'
import { ACCOUNTS_FILE, SESSION_FILE } from './helpers'

/**
 * Opens a back-office session, once, and saves the cookie.
 *
 * Through `/api/test/session`, the same back door the authorization suite
 * uses: going through Google would mean a third-party account, a consent
 * screen and a captcha, none of which say anything about this site.
 *
 * That route only exists when NUXT_TEST_ROUTES was true AT BUILD TIME and
 * the environment is `dev` — two independent locks, so the door is absent
 * from the production image rather than merely disabled.
 */
setup('open a developer session', async ({ request }) => {
  const accounts = JSON.parse(readFileSync(ACCOUNTS_FILE, 'utf8')) as Record<string, number>

  const r = await request.post('/api/test/session', { data: { id: accounts.developer } })
  expect(
    r.ok(),
    'la route /api/test/session est absente : construire avec NUXT_TEST_ROUTES=true (pnpm build:e2e)',
  ).toBe(true)

  await request.storageState({ path: SESSION_FILE })
})
