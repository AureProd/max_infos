import { expect, test } from '@playwright/test'
import { expectNoSideScroll, SESSION_FILE, tokenValue } from './helpers'

/**
 * The defect no server-side test can see.
 *
 * Every assertion in `pnpm test` reads HTML. A page whose content is 40px
 * wider than the phone it is read on produces perfectly correct HTML — and
 * a site Max cannot show anyone. That is what this file measures, and it
 * measures it at the three widths the project claims to support.
 */

const PUBLIC_PAGES = ['/', '/about', '/login', '/privacy', '/legal', '/terms']

test.describe('the public pages', () => {
  for (const path of PUBLIC_PAGES) {
    test(`${path} never scrolls sideways`, async ({ page }) => {
      await page.goto(path)
      await expectNoSideScroll(page)
    })
  }

  test('an article never scrolls sideways', async ({ page }) => {
    await page.goto('/')
    // The first article of the home page, whatever the seed contains: a
    // slug written down here would rot the day the mock-up content moves.
    const first = page.locator('a[href^="/article/"]').first()
    await first.click()
    await expect(page).toHaveURL(/\/article\//)
    await expectNoSideScroll(page)
  })
})

const ADMIN_SCREENS = [
  '/admin',
  '/admin/articles',
  '/admin/publications',
  '/admin/social',
  '/admin/about',
  '/admin/tech',
]

test.describe('the back-office', () => {
  test.use({ storageState: SESSION_FILE })

  for (const path of ADMIN_SCREENS) {
    test(`${path} never scrolls sideways`, async ({ page }) => {
      await page.goto(path)
      // The screen is actually rendered, not the sign-in page: a redirect
      // would give a narrow page that passes the overflow check for the
      // worst possible reason.
      await expect(page.locator('.admin-shell')).toBeVisible()
      await expectNoSideScroll(page)
    })
  }
})

/**
 * The palette and the fonts, as the BROWSER resolves them.
 *
 * `test/unit/design-tokens.spec.ts` reads the sheet as text, which proves
 * the token is written. It does not prove it survives Tailwind's compiler,
 * the cascade layers and PrimeVue's runtime injection — and that whole
 * chain is new.
 */
test.describe('the theme', () => {
  test('resolves the Substack accent on the page itself', async ({ page }) => {
    await page.goto('/')
    expect(await tokenValue(page, '--color-accent')).toBe('#2563eb')
    expect(await tokenValue(page, '--color-ink')).toBe('#363737')
  })

  test('is light, and says so to the browser', async ({ page }) => {
    await page.goto('/')
    const scheme = await page.evaluate(() => getComputedStyle(document.documentElement).colorScheme)
    expect(scheme).toBe('light')
  })

  test('loads both Substack fonts, and actually paints with them', async ({ page }) => {
    await page.goto('/')
    await page.evaluate(() => document.fonts.ready)

    const loaded = await page.evaluate(() =>
      [...document.fonts].filter((f) => f.status === 'loaded').map((f) => f.family),
    )
    expect(loaded).toContain('BBH Hegarty')
    expect(loaded).toContain('Lexend')

    // Loaded is not painted: a heading still wearing Arial means the token
    // never reached the rule.
    const heading = page.locator('h1').first()
    await expect(heading).toBeVisible()
    const family = await heading.evaluate((el) => getComputedStyle(el).fontFamily)
    expect(family).toContain('BBH Hegarty')
  })
})

/**
 * The cascade, proven where it actually matters.
 *
 * A Tailwind utility losing to the PrimeVue theme is invisible in every
 * sheet read as text: both files are correct, only their ORDER is wrong.
 * That order is carried by a single `@layer a, b, c;` statement which
 * PrimeVue injects AT RUNTIME, from `cssLayer.order` — so the only honest
 * place to read it is a running browser.
 *
 * Note for anyone tempted to test this by adding a utility class from
 * JavaScript: it will not work, and not for the reason it looks like.
 * Tailwind v4 generates only the classes it finds in the SOURCE FILES, so a
 * class invented at runtime is simply absent from the sheet and resolves to
 * nothing — which reads exactly like losing the cascade.
 */
test.describe('the cascade', () => {
  // On a back-office screen: the public site deliberately loads nothing of
  // PrimeVue, so the statement it injects does not exist there.
  test.use({ storageState: SESSION_FILE })

  test('declares the layers in the one order that works', async ({ page }) => {
    await page.goto('/admin/articles')
    await expect(page.locator('.admin-shell')).toBeVisible()

    const declared = await page.evaluate(() => {
      const lists: string[][] = []
      for (const sheet of [...document.styleSheets]) {
        let rules: CSSRuleList
        try {
          rules = sheet.cssRules
        } catch {
          // A cross-origin sheet — Google Fonts — refuses to be read.
          continue
        }
        for (const rule of [...rules]) {
          // CSSLayerStatementRule: the `@layer a, b, c;` form, the only one
          // that decides precedence. `@layer x { … }` blocks are a
          // different rule type and say nothing about order.
          const names = (rule as CSSLayerStatementRule).nameList
          if (names) lists.push([...names])
        }
      }
      return lists
    })

    const order = declared.find((l) => l.includes('primevue'))
    expect(order, "aucune instruction @layer ne nomme 'primevue'").toBeDefined()
    expect(order).toEqual(['theme', 'base', 'primevue', 'site', 'components', 'utilities'])
  })
})
