import { readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { fetch, setup } from '@nuxt/test-utils/e2e'
import type postgres from 'postgres'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { SETTING_DEFAULTS, SETTING_SCOPE, type SettingKey } from '#shared/schemas/settings'
import { appUser } from '../../server/database/schema'
import { base, connection, migrate, type TestDatabase } from '../setup/db'

/**
 * Le garde-fou le plus important du projet.
 *
 * Le plan le dit : « le non-respect de cette règle est le pire risque du
 * projet ». Mais le risque réel n'est PAS qu'une route soit mal protégée
 * aujourd'hui — c'est qu'une route ajoutée dans six mois soit oubliée dans
 * une matrice tenue à la main.
 *
 * D'où l'inventaire par le système de files : la matrice doit couvrir
 * EXACTEMENT les routes qui existent. Une route ajoutée sans y être
 * inscrite fait échouer le test en nommant le file fautif.
 */

const ADMIN_FOLDER = join(process.cwd(), 'server/api/admin')

/** Traduit un file de route Nitro en « MÉTHODE /path ». */
function routesFromFiles(folder: string, prefixe = '/api/admin'): string[] {
  const found: string[] = []
  for (const entry of readdirSync(folder)) {
    const path = join(folder, entry)
    if (statSync(path).isDirectory()) {
      found.push(...routesFromFiles(path, `${prefixe}/${entry}`))
      continue
    }
    const m = entry.match(/^(.+)\.(get|post|put|patch|delete)\.ts$/)
    if (!m) continue
    const [, name, methode] = m
    const routePath = name === 'index' ? prefixe : `${prefixe}/${name}`
    found.push(`${methode?.toUpperCase()} ${routePath}`)
  }
  return found.sort()
}

/**
 * Ce qu'on ATTEND, tenu à la main. Toute route admin doit y figurer.
 * anonyme → 401 (« identifie-toi »), editor sans droit → 403 (« non »).
 *
 * `body` fournit une charge valid quand la route en exige une : sans
 * elle, un 400 masquerait le code d'autorisation qu'on veut vérifier.
 */
interface Pending {
  anonyme: number
  editor: number
  tech: number
  body?: unknown
}

const DRAFT = {
  title: 'Article de la matrice',
  bodyMd: 'Un corps.',
  tags: ['matrice'],
  featured: false,
}

const EXPECTED: Record<string, Pending> = {
  'GET /api/admin/dashboard': { anonyme: 401, editor: 200, tech: 200 },
  'GET /api/admin/articles': { anonyme: 401, editor: 200, tech: 200 },
  'POST /api/admin/articles': { anonyme: 401, editor: 201, tech: 201, body: DRAFT },
  'GET /api/admin/articles/[slug]': { anonyme: 401, editor: 200, tech: 200 },
  'PUT /api/admin/articles/[slug]': { anonyme: 401, editor: 200, tech: 200, body: DRAFT },
  'DELETE /api/admin/articles/[slug]': { anonyme: 401, editor: 404, tech: 404 },
  'PUT /api/admin/articles/[slug]/status': {
    anonyme: 401,
    editor: 200,
    tech: 200,
    body: { status: 'draft' },
  },
  'POST /api/admin/preview': {
    anonyme: 401,
    editor: 200,
    tech: 200,
    body: { bodyMd: '## Titre' },
  },
  'GET /api/admin/media': { anonyme: 401, editor: 200, tech: 200 },
  'POST /api/admin/media/upload-url': {
    anonyme: 401,
    editor: 201,
    tech: 201,
    body: { filename: 'photo.png', contentType: 'image/png', bytes: 1024 },
  },
  'GET /api/admin/tags': { anonyme: 401, editor: 200, tech: 200 },
  'GET /api/admin/social-posts': { anonyme: 401, editor: 200, tech: 200 },
  'POST /api/admin/social-posts': {
    anonyme: 401,
    editor: 201,
    tech: 201,
    body: { network: 'linkedin', url: 'https://www.linkedin.com/posts/x' },
  },
  // Identifiant inexistant : 404 après le contrôle de rôle, qui est ce
  // qu'on vérifie here. Un anonyme, lui, reçoit 401 before d'y arriver.
  'DELETE /api/admin/social-posts/[id]': { anonyme: 401, editor: 404, tech: 404 },
  'PUT /api/admin/social-posts/[id]/article': {
    anonyme: 401,
    editor: 404,
    tech: 404,
    body: { articleSlug: null },
  },
  'PUT /api/admin/social-posts/[id]/visibility': {
    anonyme: 401,
    editor: 404,
    tech: 404,
    body: { hidden: true },
  },
  'GET /api/admin/articles/[slug]/variants': { anonyme: 401, editor: 200, tech: 200 },

  // Les accounts sociaux appartiennent à Max : il les signedIn, les ordonne,
  // les masque et les déconnecte. Les secrets de l'application Meta, eux,
  // ne quittent pas le serveur.
  'GET /api/admin/social-accounts': { anonyme: 401, editor: 200, tech: 200 },
  'PUT /api/admin/social-accounts/[id]': {
    anonyme: 401,
    editor: 404,
    tech: 404,
    body: { visible: true },
  },
  'DELETE /api/admin/social-accounts/[id]': { anonyme: 401, editor: 404, tech: 404 },
  // 409 : aucun account connecté dans les tests. Ce qui account est qu'un
  // `editor` ne soit plus refusé.
  'POST /api/admin/instagram/sync': { anonyme: 401, editor: 409, tech: 409 },
  // 409 également : sans NUXT_INSTAGRAM_APP_ID, il n'y a nulle part où
  // envoyer Max.
  'GET /api/admin/instagram/connect': { anonyme: 401, editor: 409, tech: 409 },
  // 400 : ni code ni état dans la requête de la matrice.
  'GET /api/admin/instagram/callback': { anonyme: 401, editor: 400, tech: 400 },

  // --- Réservé au rôle technique -------------------------------------------
  'GET /api/admin/settings': { anonyme: 401, editor: 200, tech: 200 },
  // Un seul path, mais un rôle exigé qui DÉPEND DE LA CLÉ. La matrice
  // couvre here le cas d'une clé publique ; l'autre portée est vérifiée par
  // le bloc « réglages par portée », qui énumère SETTING_SCOPE.
  'PUT /api/admin/settings/[key]': {
    anonyme: 401,
    editor: 200,
    tech: 200,
    body: {
      name: 'Un Max d’info',
      author: 'Maximilien Huet',
      byline: 'Max',
      tagline: '',
      pitch: '',
    },
  },

  'GET /api/admin/users': { anonyme: 401, editor: 403, tech: 200 },
  'GET /api/admin/export': { anonyme: 401, editor: 403, tech: 200 },
  'POST /api/admin/import': {
    anonyme: 401,
    editor: 403,
    tech: 200,
    // Simulation : n'écrit rien, ce qui laisse la matrice sans effet de bord.
    body: { archive: { manifest: { version: 1 } }, dryRun: true },
  },
}

/**
 * Le slug sur lequel les routes paramétrées opèrent.
 *
 * DELETE vise volontairement un slug INEXISTANT et attend 404 : la matrice
 * vérifie l'autorisation, pas la suppression, et détruire l'article
 * casserait les cas suivants. Un 404 prouve all autant que le contrôle de
 * rôle a été franchi — un anonyme, lui, reçoit 401 before d'y arriver.
 */
const SLUG_EXISTANT = 'article-de-la-matrice'
const SLUG_ABSENT = 'jamais-vu-de-la-matrice'

let sqlClient: postgres.Sql
let db: TestDatabase
const accounts: Record<'editor' | 'tech', number> = { editor: 0, tech: 0 }

beforeAll(async () => {
  sqlClient = connection()
  await migrate(sqlClient)
  db = base(sqlClient)
  const [e] = await db
    .insert(appUser)
    .values({ email: 'max@exemple.test', role: 'editor' })
    .returning({ id: appUser.id })
  const [t] = await db
    .insert(appUser)
    .values({ email: 'jb@exemple.test', role: 'tech' })
    .returning({ id: appUser.id })
  accounts.editor = e?.id ?? 0
  accounts.tech = t?.id ?? 0

  // L'article sur lequel opèrent les routes paramétrées.
  const { article } = await import('../../server/database/schema')
  await db.insert(article).values({
    slug: SLUG_EXISTANT,
    title: 'Article de la matrice',
    bodyMd: 'Un corps.',
  })
}, 60_000)

afterAll(async () => {
  await sqlClient?.end()
})

await setup({ server: true, browser: false })

/** Un cookie de session scellé, sans passer par Google. */
async function sessionFor(role: 'editor' | 'tech'): Promise<string> {
  const r = await fetch('/api/test/session', {
    method: 'POST',
    body: JSON.stringify({ id: accounts[role] }),
    headers: { 'content-type': 'application/json' },
  })
  return r.headers.get('set-cookie') ?? ''
}

describe('inventaire des routes', () => {
  it('la matrice couvre EXACTEMENT les routes admin existantes', () => {
    const existing = routesFromFiles(ADMIN_FOLDER)
    const declared = Object.keys(EXPECTED).sort()

    const forgotten = existing.filter((r) => !declared.includes(r))
    const orphans = declared.filter((r) => !existing.includes(r))

    expect(forgotten, `Route(s) admin sans attente déclarée : ${forgotten.join(', ')}`).toEqual([])
    expect(orphans, `Attente(s) sans route : ${orphans.join(', ')}`).toEqual([])
  })

  it('trouve au moins une route, sinon l’inventaire ne prouve rien', () => {
    // Un inventaire vide ferait passer le test précédent sans rien vérifier.
    expect(routesFromFiles(ADMIN_FOLDER).length).toBeGreaterThan(0)
  })
})

describe('matrice route × rôle', () => {
  const cas = Object.entries(EXPECTED).flatMap(([route, attentes]) =>
    (['anonyme', 'editor', 'tech'] as const).map((qui) => [route, qui, attentes[qui]] as const),
  )

  it.each(cas)('%s — %s → %i', async (route, qui, expected) => {
    const [methode, template] = route.split(' ') as [string, string]
    const slug = methode === 'DELETE' ? SLUG_ABSENT : SLUG_EXISTANT
    // [id] vise volontairement une publication inexistante : la matrice
    // vérifie l'autorisation, pas la manipulation.
    const path = template
      .replace('[slug]', slug)
      .replace('[id]', '999999')
      .replace('[key]', 'identity')
    const cookie = qui === 'anonyme' ? '' : await sessionFor(qui)
    const body = EXPECTED[route]?.body

    const r = await fetch(path, {
      method: methode,
      headers: {
        ...(cookie ? { cookie } : {}),
        ...(body ? { 'content-type': 'application/json' } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    })
    expect(r.status).toBe(expected)
  })
})

describe('réglages par portée', () => {
  /**
   * La frontière entre ce que Max règle et ce que seul JB voit.
   *
   * On ÉNUMÈRE SETTING_SCOPE au lieu de recopier la list : un réglage
   * technique ajouté demain est couvert sans que personne n'y pense.
   */
  const keys = Object.keys(SETTING_SCOPE) as SettingKey[]

  it('il y a bien des réglages des deux portées', () => {
    expect(keys.filter((c) => SETTING_SCOPE[c] === 'tech').length).toBeGreaterThan(0)
    expect(keys.filter((c) => SETTING_SCOPE[c] === 'public').length).toBeGreaterThan(0)
  })

  it.each(keys)('PUT settings/%s — editor', async (key) => {
    const expected = SETTING_SCOPE[key] === 'tech' ? 403 : 200
    const r = await fetch(`/api/admin/settings/${key}`, {
      method: 'PUT',
      headers: { cookie: await sessionFor('editor'), 'content-type': 'application/json' },
      // Le schéma valid du réglage : un 400 masquerait le code qu'on teste.
      body: JSON.stringify(SETTING_DEFAULTS[key]),
    })
    expect(r.status).toBe(expected)
  })

  it('GET settings ne renvoie AUCUN réglage technique à un editor', async () => {
    const r = await fetch('/api/admin/settings', {
      headers: { cookie: await sessionFor('editor') },
    })
    const received = Object.keys((await r.json()) as Record<string, unknown>)
    for (const key of keys.filter((c) => SETTING_SCOPE[c] === 'tech')) {
      expect(received, `${key} ne doit pas être renvoyé à un editor`).not.toContain(key)
    }
  })

  it('GET settings renvoie TOUT à un tech', async () => {
    const r = await fetch('/api/admin/settings', {
      headers: { cookie: await sessionFor('tech') },
    })
    const received = Object.keys((await r.json()) as Record<string, unknown>)
    for (const key of keys) expect(received).toContain(key)
  })
})

describe('invariant du projet', () => {
  it('editor reçoit 403 sur TOUTES les routes techniques', () => {
    const technical = Object.entries(EXPECTED).filter(([, a]) => a.tech !== a.editor)
    expect(technical.length).toBeGreaterThan(0)
    for (const [route, a] of technical) {
      expect(a.editor, `${route} doit refuser editor`).toBe(403)
    }
  })

  it('aucune route admin n’est ouverte aux anonymes', () => {
    for (const [route, a] of Object.entries(EXPECTED)) {
      expect(a.anonyme, `${route} doit exiger une connexion`).toBe(401)
    }
  })
})
