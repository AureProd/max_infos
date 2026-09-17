import { join } from 'node:path'
import { expect, type Page } from '@playwright/test'

/**
 * The throwaway database of the development compose — the same one the
 * `api` suite uses, which is exactly why the two suites must never run at
 * the same time: they would truncate each other.
 */
export const E2E_DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? 'postgres://unmaxdinfo:test@127.0.0.1:15000/unmaxdinfo_test'

/** Where `prepare.ts` leaves the account ids. */
export const ACCOUNTS_FILE = join(process.cwd(), 'test/e2e/.accounts.json')

/** Where `signin.setup.ts` leaves the back-office cookie. */
export const SESSION_FILE = join(process.cwd(), 'test/e2e/.session.json')

/**
 * Nothing sticks out sideways.
 *
 * THE assertion of this suite. A page wider than its viewport is the defect
 * a phone shows and a desk never does, and no amount of server-side testing
 * can see it — the HTML is perfectly correct.
 *
 * Measured on `documentElement`, and with a pixel of slack: sub-pixel
 * rounding on a fractional viewport otherwise reports a one-off overflow
 * that no one can see.
 */
export async function expectNoSideScroll(page: Page): Promise<void> {
  const overflow = await page.evaluate(() => {
    const el = document.documentElement
    return { scroll: el.scrollWidth, client: el.clientWidth }
  })
  expect(
    overflow.scroll,
    `débordement horizontal : ${overflow.scroll}px de contenu pour ${overflow.client}px de fenêtre`,
  ).toBeLessThanOrEqual(overflow.client + 1)
}

/** The computed value of one CSS custom property, as the browser resolves it. */
export function tokenValue(page: Page, name: string): Promise<string> {
  return page.evaluate(
    (n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim(),
    name,
  )
}
