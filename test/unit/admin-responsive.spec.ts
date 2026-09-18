import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { declarationsOf, mediaBlock, rules } from './helpers/css'

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

  it('garde l’en-tête sur UNE ligne', () => {
    // Replié, il empilait la marque, le select et les deux sorties sur trois
    // rangées, et mangeait le tiers de l'écran avant le premier mot de la
    // page. Ce qui rentre, c'est ce qui rétrécit : la marque tombe à son
    // point, les deux sorties à leur seule icône.
    expect(declarationsOf(phone ?? '', '.admin-head-in')).toMatch(/flex-wrap:\s*nowrap/)
    expect(declarationsOf(phone ?? '', '.admin-out-long')).toMatch(/display:\s*none/)
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

  it('wraps every PrimeVue table in the container the phone rules target', () => {
    // Counted rather than walked: a real tree walk would need a parser, and
    // the count catches the case that matters — a table added bare.
    //
    // `.a-scroll-x` is no longer a horizontal scroller on a phone: it is the
    // hook the media query uses to unfold the table into stacked cards. A
    // table added outside it keeps its five columns on a 390px screen.
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

  it('labels every PrimeVue column, so a stacked cell still says what it is', () => {
    /*
     * A `<Column>` writes no `data-label` of its own — that is why the
     * library's tables were the only ones still scrolling sideways. `cell()`
     * adds one through `pt`, and a column added without it becomes, on a
     * phone, a value with nothing naming it.
     */
    const guilty: string[] = []
    for (const file of TEMPLATES) {
      for (const tag of read(file).match(/<Column\b[^>]*>/g) ?? []) {
        if (!/:pt="cell\(/.test(tag)) guilty.push(`${file} — ${tag.slice(0, 70)}…`)
      }
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

/**
 * Ce qui pousse la page hors de l'écran.
 *
 * Un `width: 100%` ne contraint PAS la taille minimale automatique d'un
 * élément de flex ou de grille : pendant le calcul intrinsèque, un
 * pourcentage est indéfini, donc ni `width` ni `max-width` ne bornent quoi
 * que ce soit. Ce qui borne, c'est `min-width: 0`.
 *
 * Le `<select>` de MediaPicker en est le cas d'école : sa largeur
 * min-content est celle de son option la plus longue — un nom de fichier
 * téléversé. Elle remonte de `.cluster` à `.admin-card`, de là à la piste
 * `1fr` de `.a-editor`, et la page entière défile latéralement.
 *
 * `.a-input` et `.a-select` portaient déjà `min-width: 0`. Les contrôles
 * NUS, eux, avaient été oubliés.
 */
describe('ce qui peut pousser la page hors de l’écran', () => {
  const controls = rules(ADMIN_CSS).filter(
    (r) =>
      /\b(select|textarea|input\[)/.test(r.selector) && /(^|[^-\w])width:\s*100%/m.test(r.body),
  )

  it('trouve la règle qui dimensionne les contrôles', () => {
    expect(controls.length).toBeGreaterThan(0)
  })

  it('borne tout contrôle dimensionné en pourcentage', () => {
    const guilty = controls.filter((r) => !/min-width:\s*0/.test(r.body)).map((r) => r.selector)
    expect(guilty).toEqual([])
  })

  it('laisse les cartes de l’éditeur rétrécir sous leur contenu', () => {
    // Un élément de grille vaut `min-width: auto` par défaut : il ne
    // descend jamais sous la largeur min-content de ce qu'il contient.
    expect(declarationsOf(ADMIN_CSS, '.a-editor > *')).toMatch(/min-width:\s*0/)
  })
})

/**
 * Les deux formes du menu, et laquelle se voit.
 *
 * La bascule est en CSS parce qu'elle ne peut pas être ailleurs : le rendu
 * serveur ne connaît pas la largeur de la fenêtre. Ce que le test garde,
 * c'est qu'exactement une des deux est visible de chaque côté de 900px —
 * une bascule à moitié écrite affiche les deux, ou aucune.
 */
describe('le menu de l’en-tête', () => {
  const narrow = mediaBlock(ADMIN_CSS, '(max-width: 900px)') ?? ''

  // Le sélecteur porte `.admin-ui` devant : la règle générique
  // `.admin-ui select` pèse une classe de plus et lui reprenait sinon son
  // rembourrage et son chevron.
  const SELECT = '.admin-ui .admin-menu-select'

  it('cache le select tant que la fenêtre est large', () => {
    expect(declarationsOf(ADMIN_CSS, SELECT)).toMatch(/display:\s*none/)
  })

  it('échange les deux sous 900px', () => {
    expect(declarationsOf(narrow, '.admin-menu')).toMatch(/display:\s*none/)
    expect(declarationsOf(narrow, SELECT)).toMatch(/display:\s*block/)
  })
})
