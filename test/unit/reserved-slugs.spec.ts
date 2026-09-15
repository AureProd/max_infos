import { readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { RESERVED_SLUGS, slugify } from '#shared/utils/slug'

/**
 * `/admin/<slug>` est l'éditeur d'article, mais Nuxt fait passer les
 * routes statiques before les dynamiques. Un écran ajouté dans
 * `app/pages/admin/` vole donc silencieusement son URL à all article
 * portant le même slug, qui devient inaccessible.
 *
 * Ce test compare la list tenue à la main au content RÉEL du folder : un
 * écran ajouté demain sans être inscrit fait rougir la CI en le nommant.
 */
describe('slugs réservés du back-office', () => {
  const screens = readdirSync(join(process.cwd(), 'app/pages/admin'))
    .filter((f) => f.endsWith('.vue') && !f.startsWith('[') && f !== 'index.vue')
    .map((f) => f.replace(/\.vue$/, ''))
    .sort()

  it('couvre exactement les écrans existants', () => {
    expect([...RESERVED_SLUGS].sort()).toEqual(screens)
  })

  it('sont tous des slugs qu’un titre peut produire', () => {
    // Si un écran s'appelait « mon_ecran », aucun titre ne donnerait ce
    // slug et la réservation serait inutile — autant le savoir.
    for (const s of RESERVED_SLUGS) expect(slugify(s)).toBe(s)
  })
})
