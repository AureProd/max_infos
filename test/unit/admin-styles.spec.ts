import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { rules } from './helpers/css'

/**
 * The back-office is not dressed from the public sheet.
 *
 * There used to be two palettes — a dark `:root` in `base.css`, a light
 * `.admin-ui` in `admin.css` — and a rule written in the wrong sheet painted
 * a dark background under black text, which is exactly what `.a-diff`, the
 * restore comparison, did. Both now alias the same `@theme` tokens, so the
 * colours can no longer clash; what this test still holds is the SEPARATION.
 * `base.css` is loaded on every public page: an admin rule written there is
 * shipped to every visitor for nothing, and drifts away from `admin.css`
 * where its siblings live.
 *
 * Nothing else catches it: Biome does not read CSS, `vue-tsc` neither, and
 * the defect is invisible until someone looks at the screen.
 */

const CSS = readFileSync(join(process.cwd(), 'app/assets/css/base.css'), 'utf8')

/** The aliases the public sheet defines for itself, not for the tool. */
const PUBLIC_PALETTE = /var\(--(surface|ink|text|line|muted|raised|accent)\b/

/** A property that would make something visible — or invisible. */
const PAINTS = /^\s*(color|background|background-color|border|border-[a-z-]+)\s*:/

/** A rule that dresses a back-office screen, by its class prefix. */
const isAdmin = (selector: string): boolean => /(^|[\s,>])\.(a-|admin-)/.test(selector)

describe('the sheet of the public site', () => {
  it('never paints a back-office rule with the palette of the site', () => {
    const guilty = rules(CSS)
      .filter((r) => isAdmin(r.selector))
      .filter((r) =>
        r.body.split(';').some((line) => PAINTS.test(line) && PUBLIC_PALETTE.test(line)),
      )
      .map((r) => r.selector)

    expect(guilty).toEqual([])
  })

  /**
   * The public sheet must not dress the back-office AT ALL.
   *
   * The prefix rule above missed the worst of it: a whole section headed
   * « Back-office (lots 5 to 8) » sat in `base.css` under class names that
   * carry no prefix — `.field`, `.editor`, `.preview`, `.cnav`, `.pill`.
   * Every visitor downloaded it, and it still painted the admin: the
   * « Présentation » field of the About screen stood 460px tall because of
   * a `min-height` written there for the body of an article.
   */
  const ADMIN_ONLY = ['.editor', '.field', '.preview', '.cnav', '.pill']

  it('carries no rule for a back-office-only class', () => {
    const guilty = rules(CSS)
      .map((r) => r.selector)
      .filter((sel) =>
        sel
          .split(',')
          .some((one) =>
            ADMIN_ONLY.some((name) => new RegExp(`(^|[\\s>])\\${name}\\b`).test(one.trim())),
          ),
      )
    expect(guilty).toEqual([])
  })

  it('reads the rules it claims to read', () => {
    // Without this, a parser returning nothing would make the test above
    // pass on an empty list — the most comfortable kind of green.
    const found = rules(CSS)
    expect(found.length).toBeGreaterThan(100)
    expect(found.some((r) => r.selector.includes('.chip'))).toBe(true)
  })
})

/**
 * The filled PrimeVue controls wear the blue of the site, not Aura's.
 *
 * Aura's `primary` palette is emerald. Every `<Button>` without a severity
 * — « Inviter », « Rattacher », « Fermer » — therefore came out GREEN in a
 * back-office whose every other action is the logo blue, and so did the
 * checked ToggleSwitch and the active tab. Nothing said so: it is a default
 * of the library, not a line of this repository.
 */
describe('the theme of the back-office controls', () => {
  const CONFIG = readFileSync(join(process.cwd(), 'nuxt.config.ts'), 'utf8')
  const MAIN = readFileSync(join(process.cwd(), 'app/assets/css/main.css'), 'utf8')

  /**
   * The accent, read from the ONE place it is written — the `@theme` block.
   * `.admin-ui` only aliases it now, so reading `--a-accent` would compare
   * the config to the string `var(--color-accent)`.
   */
  const accent = /--color-accent:\s*(#[0-9a-f]{6})/i.exec(MAIN)?.[1]?.toLowerCase()

  it('reads an accent from the tokens at all', () => {
    expect(accent).toMatch(/^#[0-9a-f]{6}$/)
  })

  it('overrides Aura’s primary palette rather than inheriting emerald', () => {
    expect(CONFIG).toMatch(/primary:\s*\{/)
  })

  it('anchors that palette on the very accent of the sheet', () => {
    const palette = /primary:\s*\{([\s\S]*?)\}/.exec(CONFIG)?.[1] ?? ''
    expect(palette.toLowerCase()).toContain(accent)
  })
})
