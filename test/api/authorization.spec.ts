import { readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { fetch, setup } from '@nuxt/test-utils/e2e'
import type postgres from 'postgres'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { SETTING_DEFAULTS, SETTING_SCOPE, type SettingKey } from '#shared/schemas/settings'
import { appUser } from '../../server/database/schema'
import { connection, database, migrate, type TestDatabase } from '../setup/db'

/**
 * The most important guard rail of the project.
 *
 * The plan says it: « breaking this rule is the worst risk of the
 * project ». But the real risk is NOT that a route is badly protected
 * today — it is that a route added six months from now is forgotten in a
 * hand-kept matrix.
 *
 * Hence the inventory through the file system: the matrix must cover
 * EXACTLY the routes that exist. A route added without being listed fails
 * the test, naming the offending file.
 */

const ADMIN_FOLDER = join(process.cwd(), 'server/api/admin')

/** Turns a Nitro route file into « METHOD /path ». */
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
 * What is EXPECTED, kept by hand. Every admin route must appear here.
 * anonymous → 401 (« identify yourself »), editor without the right → 403
 * (« no »).
 *
 * `body` supplies a valid payload when the route requires one: without it,
 * a 400 would mask the authorization code we want to check.
 */
interface Pending {
  anonyme: number
  editor: number
  developer: number
  body?: unknown
}

const DRAFT = {
  title: 'Article de la matrice',
  bodyHtml: '<p>Un corps.</p>',
  tags: ['matrice'],
  featured: false,
}

const EXPECTED: Record<string, Pending> = {
  'GET /api/admin/dashboard': { anonyme: 401, editor: 200, developer: 200 },
  'GET /api/admin/articles': { anonyme: 401, editor: 200, developer: 200 },
  'POST /api/admin/articles': { anonyme: 401, editor: 201, developer: 201, body: DRAFT },
  'GET /api/admin/articles/[slug]': { anonyme: 401, editor: 200, developer: 200 },
  'PUT /api/admin/articles/[slug]': { anonyme: 401, editor: 200, developer: 200, body: DRAFT },
  'DELETE /api/admin/articles/[slug]': { anonyme: 401, editor: 404, developer: 404 },
  'PUT /api/admin/articles/[slug]/status': {
    anonyme: 401,
    editor: 200,
    developer: 200,
    body: { status: 'draft' },
  },
  'POST /api/admin/preview': {
    anonyme: 401,
    editor: 200,
    developer: 200,
    body: { bodyHtml: '<h2>Titre</h2>' },
  },
  'GET /api/admin/media': { anonyme: 401, editor: 200, developer: 200 },
  'POST /api/admin/media/upload-url': {
    anonyme: 401,
    editor: 201,
    developer: 201,
    body: { filename: 'photo.png', contentType: 'image/png', bytes: 1024 },
  },
  'GET /api/admin/tags': { anonyme: 401, editor: 200, developer: 200 },
  // An unknown subject: 404 AFTER the role check, which is what is verified
  // here. A subject still carried by an article answers 409, and that
  // refusal has its own test.
  'DELETE /api/admin/tags/[slug]': { anonyme: 401, editor: 404, developer: 404 },
  'PUT /api/admin/tags/[slug]': {
    anonyme: 401,
    editor: 404,
    developer: 404,
    body: { label: 'Peu importe' },
  },
  // Reading a pasted link never fails on the remote page's behalf: an
  // unreachable address comes back as empty fields, not as an error.
  'POST /api/admin/social-posts/unfurl': {
    anonyme: 401,
    editor: 200,
    developer: 200,
    body: { url: 'https://exemple.invalid/x' },
  },
  'GET /api/admin/social-posts': { anonyme: 401, editor: 200, developer: 200 },
  'POST /api/admin/social-posts': {
    anonyme: 401,
    editor: 201,
    developer: 201,
    body: { network: 'linkedin', url: 'https://www.linkedin.com/posts/x' },
  },
  // A non-existent identifier: 404 after the role check, which is what we
  // verify here. An anonymous caller gets 401 before reaching it.
  'DELETE /api/admin/social-posts/[id]': { anonyme: 401, editor: 404, developer: 404 },
  'PUT /api/admin/social-posts/[id]/article': {
    anonyme: 401,
    editor: 404,
    developer: 404,
    body: { articleSlug: null },
  },
  'PUT /api/admin/social-posts/[id]/visibility': {
    anonyme: 401,
    editor: 404,
    developer: 404,
    body: { hidden: true },
  },
  // 999999 n'existe pas : 404 APRÈS le contrôle de rôle, ce qui est
  // exactement ce qu'on mesure ici.
  'PUT /api/admin/social-posts/[id]/caption': {
    anonyme: 401,
    editor: 404,
    developer: 404,
    body: { caption: 'Un titre corrigé' },
  },
  'GET /api/admin/articles/[slug]/variants': { anonyme: 401, editor: 200, developer: 200 },

  // The social accounts belong to Max: he connects, orders, hides and
  // disconnects them. The Meta application secrets, for their part, never
  // leave the server.
  'GET /api/admin/social-accounts': { anonyme: 401, editor: 200, developer: 200 },
  'PUT /api/admin/social-accounts/[id]': {
    anonyme: 401,
    editor: 404,
    developer: 404,
    body: { visible: true },
  },
  'DELETE /api/admin/social-accounts/[id]': { anonyme: 401, editor: 404, developer: 404 },
  // 409: no account connected in the tests. What counts is that an
  // `editor` is no longer refused.
  'POST /api/admin/instagram/sync': { anonyme: 401, editor: 409, developer: 409 },
  // 409 as well: without NUXT_INSTAGRAM_APP_ID, there is nowhere to send
  // Max.
  'GET /api/admin/instagram/connect': { anonyme: 401, editor: 409, developer: 409 },
  // 400: neither code nor state in the matrix request.
  'GET /api/admin/instagram/callback': { anonyme: 401, editor: 400, developer: 400 },

  // --- Reserved to the technical role ---------------------------------------
  'GET /api/admin/settings': { anonyme: 401, editor: 200, developer: 200 },
  // A single path, but a required role that DEPENDS ON THE KEY. The matrix
  // covers the public-key case here; the other scope is checked by the
  // « settings by scope » block, which enumerates SETTING_SCOPE.
  'PUT /api/admin/settings/[key]': {
    anonyme: 401,
    editor: 200,
    developer: 200,
    body: {
      name: 'Un Max d’info',
      author: 'Maximilien Huet',

      tagline: '',
      pitch: '',
    },
  },

  // Max's publication, Max's screen: `editor` passes. 409 in the tests —
  // no feed address is recorded — which is exactly what proves the role was
  // NOT the reason for the refusal. No network is touched.
  'POST /api/admin/substack/import': {
    anonyme: 401,
    editor: 409,
    developer: 409,
    body: { dryRun: true },
  },

  // Les graphiques du tableau de bord : c'est l'écran de Max, donc `editor`.
  'GET /api/admin/stats': { anonyme: 401, editor: 200, developer: 200 },

  'GET /api/admin/users': { anonyme: 401, editor: 403, developer: 200 },
  // Inviting writes a REAL row. Its own address, the least powerful role, and
  // no later case signs in with it.
  'POST /api/admin/users': {
    anonyme: 401,
    editor: 403,
    developer: 201,
    body: { email: 'matrice@exemple.test', role: 'editor' },
  },
  // 999999 does not exist: 404 AFTER the role check, which is what is being
  // measured here. Aiming at a real account could strip the `developer` whose
  // session the following cases borrow — the handler therefore reads the row
  // BEFORE applying its guard rails, or a 409 would come out instead.
  'PUT /api/admin/users/[id]': {
    anonyme: 401,
    editor: 403,
    developer: 404,
    body: { active: true },
  },
  'DELETE /api/admin/users/[id]': { anonyme: 401, editor: 403, developer: 404 },
  'GET /api/admin/export': { anonyme: 401, editor: 403, developer: 200 },
  'POST /api/admin/import': {
    anonyme: 401,
    editor: 403,
    developer: 200,
    // Dry run: writes nothing, which leaves the matrix without side effects.
    body: { archive: { manifest: { version: 1 } }, dryRun: true },
  },
}

/**
 * The slug the parameterised routes operate on.
 *
 * DELETE deliberately targets a NON-EXISTENT slug and expects 404: the
 * matrix checks authorization, not deletion, and destroying the article
 * would break the following cases. A 404 proves just as well that the role
 * check was passed — an anonymous caller gets 401 before reaching it.
 */
const SLUG_EXISTANT = 'article-de-la-matrice'
const SLUG_ABSENT = 'jamais-vu-de-la-matrice'

let sqlClient: postgres.Sql
let db: TestDatabase
const accounts: Record<'editor' | 'developer', number> = { editor: 0, developer: 0 }

beforeAll(async () => {
  sqlClient = connection()
  await migrate(sqlClient)
  db = database(sqlClient)
  const [e] = await db
    .insert(appUser)
    .values({ email: 'max@exemple.test', role: 'editor' })
    .returning({ id: appUser.id })
  const [t] = await db
    .insert(appUser)
    .values({ email: 'jb@exemple.test', role: 'developer' })
    .returning({ id: appUser.id })
  accounts.editor = e?.id ?? 0
  accounts.developer = t?.id ?? 0

  // The article the parameterised routes operate on.
  const { article } = await import('../../server/database/schema')
  await db.insert(article).values({
    slug: SLUG_EXISTANT,
    title: 'Article de la matrice',
    bodyHtml: '<p>Un corps.</p>',
  })
}, 60_000)

afterAll(async () => {
  await sqlClient?.end()
})

await setup({ server: true, browser: false })

/** A sealed session cookie, without going through Google. */
async function sessionFor(role: 'editor' | 'developer'): Promise<string> {
  const r = await fetch('/api/test/session', {
    method: 'POST',
    body: JSON.stringify({ id: accounts[role] }),
    headers: { 'content-type': 'application/json' },
  })
  return r.headers.get('set-cookie') ?? ''
}

describe('route inventory', () => {
  it('the matrix covers EXACTLY the admin routes that exist', () => {
    const existing = routesFromFiles(ADMIN_FOLDER)
    const declared = Object.keys(EXPECTED).sort()

    const forgotten = existing.filter((r) => !declared.includes(r))
    const orphans = declared.filter((r) => !existing.includes(r))

    expect(forgotten, `Route(s) admin sans attente déclarée : ${forgotten.join(', ')}`).toEqual([])
    expect(orphans, `Attente(s) sans route : ${orphans.join(', ')}`).toEqual([])
  })

  it('finds at least one route, otherwise the inventory proves nothing', () => {
    // An empty inventory would pass the previous test without checking anything.
    expect(routesFromFiles(ADMIN_FOLDER).length).toBeGreaterThan(0)
  })
})

describe('route × role matrix', () => {
  const cas = Object.entries(EXPECTED).flatMap(([route, attentes]) =>
    (['anonyme', 'editor', 'developer'] as const).map(
      (qui) => [route, qui, attentes[qui]] as const,
    ),
  )

  it.each(cas)('%s — %s → %i', async (route, qui, expected) => {
    const [methode, template] = route.split(' ') as [string, string]
    const slug = methode === 'DELETE' ? SLUG_ABSENT : SLUG_EXISTANT
    // [id] deliberately targets a non-existent post: the matrix checks
    // authorization, not the operation.
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

describe('settings by scope', () => {
  /**
   * The border between what Max configures and what only JB sees.
   *
   * We ENUMERATE SETTING_SCOPE instead of copying the list: a technical
   * setting added tomorrow is covered without anyone thinking about it.
   */
  const keys = Object.keys(SETTING_SCOPE) as SettingKey[]

  it('there really are settings of both scopes', () => {
    expect(keys.filter((c) => SETTING_SCOPE[c] === 'tech').length).toBeGreaterThan(0)
    expect(keys.filter((c) => SETTING_SCOPE[c] === 'public').length).toBeGreaterThan(0)
  })

  it.each(keys)('PUT settings/%s — editor', async (key) => {
    const expected = SETTING_SCOPE[key] === 'tech' ? 403 : 200
    const r = await fetch(`/api/admin/settings/${key}`, {
      method: 'PUT',
      headers: { cookie: await sessionFor('editor'), 'content-type': 'application/json' },
      // The setting's valid schema: a 400 would mask the code under test.
      body: JSON.stringify(SETTING_DEFAULTS[key]),
    })
    expect(r.status).toBe(expected)
  })

  it('GET settings returns NO technical setting to an editor', async () => {
    const r = await fetch('/api/admin/settings', {
      headers: { cookie: await sessionFor('editor') },
    })
    const received = Object.keys((await r.json()) as Record<string, unknown>)
    for (const key of keys.filter((c) => SETTING_SCOPE[c] === 'tech')) {
      expect(received, `${key} ne doit pas être renvoyé à un editor`).not.toContain(key)
    }
  })

  it('GET settings returns EVERYTHING to a developer', async () => {
    const r = await fetch('/api/admin/settings', {
      headers: { cookie: await sessionFor('developer') },
    })
    const received = Object.keys((await r.json()) as Record<string, unknown>)
    for (const key of keys) expect(received).toContain(key)
  })
})

describe('project invariant', () => {
  it('editor gets 403 on EVERY technical route', () => {
    const technical = Object.entries(EXPECTED).filter(([, a]) => a.developer !== a.editor)
    expect(technical.length).toBeGreaterThan(0)
    for (const [route, a] of technical) {
      expect(a.editor, `${route} doit refuser editor`).toBe(403)
    }
  })

  it('no admin route is open to anonymous callers', () => {
    for (const [route, a] of Object.entries(EXPECTED)) {
      expect(a.anonyme, `${route} doit exiger une connexion`).toBe(401)
    }
  })
})
