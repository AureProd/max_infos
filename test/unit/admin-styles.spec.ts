import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { rules } from './helpers/css'

/**
 * Two palettes coexist in the cascade, and the back-office pays for it.
 *
 * `base.css` is loaded everywhere, `:root` carrying the DARK palette of the
 * public site. The back-office is light: `.admin-ui` sets `--a-*` and its
 * own text colour. A rule written in `base.css` for an admin screen
 * therefore paints a dark background under black text — which is exactly
 * what `.a-diff`, the restore comparison, did.
 *
 * Nothing catches it: Biome does not read CSS, `vue-tsc` neither, and the
 * defect is invisible until someone looks at the screen.
 */

const CSS = readFileSync(join(process.cwd(), 'app/assets/css/base.css'), 'utf8')

/** The palette of the public site, which the back-office does not inherit. */
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
  const ADMIN = readFileSync(join(process.cwd(), 'app/assets/css/admin.css'), 'utf8')

  /** The accent the sheet gives to `.admin-ui`, which everything else uses. */
  const accent = /--a-accent:\s*(#[0-9a-f]{6})/i.exec(ADMIN)?.[1]?.toLowerCase()

  it('reads an accent from the sheet at all', () => {
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
