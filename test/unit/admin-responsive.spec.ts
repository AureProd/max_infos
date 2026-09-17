import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { declarationsOf, mediaBlock } from './helpers/css'

/**
 * The back-office on a phone.
 *
 * `docs/PLAN.md` asks for it in one line — « Fenêtre à 375 px : aucun
 * débordement horizontal » — and nothing enforced it. The sheet stopped at
 * 820px, the public one goes down to 640px, and the gap between the two is
 * exactly the width of a telephone.
 *
 * There is no browser in this repository, so these assertions are made on
 * the TEXT of the sheet and of the templates. They cannot prove the screen
 * looks right; they prove that the mechanisms which make it right are still
 * there, and name the one that left.
 */

const root = process.cwd()
const ADMIN_CSS = readFileSync(join(root, 'app/assets/css/admin.css'), 'utf8')

/** The breakpoint of the phone, the one `base.css` already employs. */
const PHONE = '(max-width: 640px)'

/** Every back-office template: the screens, and the panels they mount. */
const TEMPLATES = [
  ...readdirSync(join(root, 'app/pages/admin'))
    .filter((f) => f.endsWith('.vue'))
    .map((f) => join('app/pages/admin', f)),
  ...readdirSync(join(root, 'app/components'))
    .filter((f) => f.endsWith('Panel.vue'))
    .map((f) => join('app/components', f)),
]

const read = (file: string): string => readFileSync(join(root, file), 'utf8')

describe('the back-office sheet under 640px', () => {
  const phone = mediaBlock(ADMIN_CSS, PHONE)

  it('has a block for the phone at all', () => {
    expect(phone).not.toBeNull()
  })

  it('stops writing at 15px, which no one reads at arm’s length', () => {
    // 16px is also what keeps iOS from zooming into a focused field.
    expect(declarationsOf(phone ?? '', '.admin-ui')).toMatch(/font-size:\s*16px/)
  })

  it('lets the header fold instead of crushing the menu', () => {
    // `.admin-who` is `white-space: nowrap` and carries four items: without
    // a wrap, it eats the whole bar and the six screens vanish.
    expect(declarationsOf(phone ?? '', '.admin-head-in')).toMatch(/flex-wrap:\s*wrap/)
  })

  it('drops the repeatable rows to a single column', () => {
    // The 900px block stops at `1fr 1fr`: two columns of 170px each.
    for (const selector of ['.a-row-grid', '.a-row-grid.is-cv']) {
      expect(declarationsOf(phone ?? '', selector)).toMatch(/grid-template-columns:\s*1fr\s*;/)
    }
  })

  it('turns the hand-written tables into stacked cards', () => {
    const block = phone ?? ''
    expect(declarationsOf(block, '.a-table')).toMatch(/display:\s*block/)
    expect(declarationsOf(block, '.a-table thead')).toMatch(/display:\s*none/)
    // The header having gone, each cell says what it is.
    expect(block).toMatch(/content:\s*attr\(data-label\)/)
  })

  it('undoes the 700px floor the tablet block imposes', () => {
    // Left in place, it keeps forcing a sideways scroll under a layout that
    // no longer needs one.
    expect(declarationsOf(phone ?? '', '.a-table')).toMatch(/min-width:\s*(0|auto|100%)/)
  })

  it('stacks the toolbars rather than wrapping them into stumps', () => {
    expect(declarationsOf(phone ?? '', '.a-toolbar')).toMatch(/flex-direction:\s*column/)
  })

  it('offers a container that scrolls what cannot be stacked', () => {
    // PrimeVue 4 has no `responsiveLayout`, and emits no data-label: its
    // tables scroll in their frame so that the PAGE never does.
    expect(declarationsOf(mediaBlock(ADMIN_CSS, PHONE) ?? ADMIN_CSS, '.a-scroll-x')).toBeDefined()
    expect(ADMIN_CSS).toMatch(/\.a-scroll-x\s*\{[^}]*overflow-x:\s*auto/)
  })
})

describe('the back-office templates', () => {
  it('never pins a column width in a style attribute', () => {
    // An inline style cannot be overridden by a media query: a width written
    // there is a width the phone is stuck with.
    const guilty: string[] = []
    for (const file of TEMPLATES) {
      for (const tag of read(file).match(/<Column\b[^>]*>/g) ?? []) {
        if (/\sstyle=/.test(tag)) guilty.push(`${file} — ${tag.slice(0, 60)}…`)
      }
    }
    expect(guilty).toEqual([])
  })

  it('wraps every PrimeVue table in something that scrolls', () => {
    // Counted rather than walked: a real tree walk would need a parser, and
    // the count catches the case that matters — a table added bare.
    const guilty: string[] = []
    for (const file of TEMPLATES) {
      const source = read(file)
      const tables = (source.match(/<DataTable\b/g) ?? []).length
      const scrollers = (source.match(/a-scroll-x/g) ?? []).length
      if (tables > scrollers)
        guilty.push(`${file} — ${tables} tableau(x), ${scrollers} conteneur(s)`)
    }
    expect(guilty).toEqual([])
  })

  it('labels every cell of a hand-written table', () => {
    // Stacked, a cell loses its column header. Without `data-label` it
    // becomes a value with nothing saying what it is.
    const guilty: string[] = []
    for (const file of TEMPLATES) {
      const source = read(file)
      if (!source.includes('class="a-table"')) continue
      for (const tag of source.match(/<td\b[^>]*>/g) ?? []) {
        if (!/data-label=/.test(tag)) guilty.push(`${file} — ${tag}`)
      }
    }
    expect(guilty).toEqual([])
  })

  it('reads the files it claims to read', () => {
    // Without this, a wrong glob would make every list above empty — the
    // most comfortable kind of green.
    expect(TEMPLATES.length).toBeGreaterThan(8)
    expect(TEMPLATES).toContain('app/pages/admin/social.vue')
    expect(TEMPLATES).toContain('app/components/UsersPanel.vue')
  })
})
