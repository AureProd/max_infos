import { $fetch, setup } from '@nuxt/test-utils/e2e'
import type postgres from 'postgres'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { setting } from '../../server/database/schema'
import { connection, database, migrate, type TestDatabase } from '../setup/db'

/**
 * « À propos » — the page that shows what Max fills in.
 *
 * Two failures met here. The page rendered `cv.skills` ALONE, a field no
 * admin screen ever writes: the education, experience and engagements Max
 * had typed appeared nowhere. And /api/site answered with the WHOLE CV,
 * hidden entries included — the switch only removed them in the browser,
 * after the payload carrying a phone number had already been served.
 */
let sqlClient: postgres.Sql
let db: TestDatabase

beforeAll(async () => {
  sqlClient = connection()
  await migrate(sqlClient)
  db = database(sqlClient)
  await db.insert(setting).values([
    {
      key: 'identity',
      value: {
        name: "Un Max d'info",
        author: 'Maximilien Huet',
        byline: 'Max',
        tagline: 'Une accroche.',
        pitch: '',
      },
      scope: 'public',
    },
    {
      key: 'contact',
      value: {
        fields: [
          {
            key: 'email',
            label: 'E-mail',
            value: 'public@exemple.fr',
            visible: true,
            sensitive: false,
          },
          { key: 'tel', label: 'Téléphone', value: '0600112233', visible: false, sensitive: true },
        ],
      },
      scope: 'public',
    },
    {
      key: 'cv',
      value: {
        headline: 'Journaliste indépendant',
        intro: 'Une introduction de CV.',
        photoMediaId: null,
        pdfMediaId: null,
        education: {
          visible: true,
          entries: [
            {
              title: 'Master HCP',
              org: 'Université Rennes II',
              start: '2024',
              end: '2026',
              visible: true,
            },
            { title: 'Diplôme retiré', org: 'Nulle part', visible: false },
          ],
        },
        experience: { visible: false, entries: [{ title: 'Rubrique masquée', visible: true }] },
        engagements: {
          visible: true,
          entries: [
            { title: 'Scoutisme', org: 'SUF', start: '2024', end: "aujourd'hui", visible: true },
          ],
        },
        skills: [{ group: 'Langues', items: ['Anglais'] }],
        interests: [],
        languages: [],
        certifications: [],
      },
      scope: 'public',
    },
  ])
}, 60_000)

afterAll(async () => {
  await sqlClient?.end()
})

await setup({ server: true, browser: false })

describe('what /api/site is willing to hand out', () => {
  it('leaves out a contact field switched off', async () => {
    // Filtering in the browser hides it on screen and ships it anyway:
    // the number is in the payload, readable by anyone who looks.
    const site = await $fetch('/api/site')
    expect(JSON.stringify(site)).not.toContain('0600112233')
  })

  it('leaves out an entry switched off', async () => {
    expect(JSON.stringify(await $fetch('/api/site'))).not.toContain('Diplôme retiré')
  })

  it('leaves out a whole section switched off', async () => {
    expect(JSON.stringify(await $fetch('/api/site'))).not.toContain('Rubrique masquée')
  })

  it('still hands out what is meant to be seen', async () => {
    const payload = JSON.stringify(await $fetch('/api/site'))
    expect(payload).toContain('Master HCP')
    expect(payload).toContain('public@exemple.fr')
  })
})

describe('what the page actually shows', () => {
  it('shows the education Max typed, which appeared nowhere', async () => {
    const html = await $fetch<string>('/about')
    expect(html).toContain('Master HCP')
    expect(html).toContain('Université Rennes II')
  })

  it('shows the engagements too', async () => {
    expect(await $fetch<string>('/about')).toContain('Scoutisme')
  })

  it('shows the CV headline and introduction, saved but never rendered', async () => {
    const html = await $fetch<string>('/about')
    expect(html).toContain('Journaliste indépendant')
    expect(html).toContain('Une introduction de CV.')
  })

  it('shows the visible contact, and not the hidden one', async () => {
    const html = await $fetch<string>('/about')
    expect(html).toContain('public@exemple.fr')
    expect(html).not.toContain('0600112233')
  })

  it('does not show a section switched off', async () => {
    expect(await $fetch<string>('/about')).not.toContain('Rubrique masquée')
  })
})
