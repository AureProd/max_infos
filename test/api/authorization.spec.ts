import { readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { fetch, setup } from '@nuxt/test-utils/e2e'
import type postgres from 'postgres'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { SETTING_DEFAULTS, SETTING_SCOPE, type SettingKey } from '#shared/schemas/settings'
import { appUser } from '../../server/database/schema'
import { type BaseDeTest, base, connexion, migrer } from '../setup/db'

/**
 * Le garde-fou le plus important du projet.
 *
 * Le plan le dit : « le non-respect de cette règle est le pire risque du
 * projet ». Mais le risque réel n'est PAS qu'une route soit mal protégée
 * aujourd'hui — c'est qu'une route ajoutée dans six mois soit oubliée dans
 * une matrice tenue à la main.
 *
 * D'où l'inventaire par le système de fichiers : la matrice doit couvrir
 * EXACTEMENT les routes qui existent. Une route ajoutée sans y être
 * inscrite fait échouer le test en nommant le fichier fautif.
 */

const DOSSIER_ADMIN = join(process.cwd(), 'server/api/admin')

/** Traduit un fichier de route Nitro en « MÉTHODE /chemin ». */
function routesDepuisFichiers(dossier: string, prefixe = '/api/admin'): string[] {
  const trouvees: string[] = []
  for (const entree of readdirSync(dossier)) {
    const chemin = join(dossier, entree)
    if (statSync(chemin).isDirectory()) {
      trouvees.push(...routesDepuisFichiers(chemin, `${prefixe}/${entree}`))
      continue
    }
    const m = entree.match(/^(.+)\.(get|post|put|patch|delete)\.ts$/)
    if (!m) continue
    const [, nom, methode] = m
    const cheminRoute = nom === 'index' ? prefixe : `${prefixe}/${nom}`
    trouvees.push(`${methode?.toUpperCase()} ${cheminRoute}`)
  }
  return trouvees.sort()
}

/**
 * Ce qu'on ATTEND, tenu à la main. Toute route admin doit y figurer.
 * anonyme → 401 (« identifie-toi »), editor sans droit → 403 (« non »).
 *
 * `corps` fournit une charge valide quand la route en exige une : sans
 * elle, un 400 masquerait le code d'autorisation qu'on veut vérifier.
 */
interface Attente {
  anonyme: number
  editor: number
  tech: number
  corps?: unknown
}

const BROUILLON = {
  title: 'Article de la matrice',
  bodyMd: 'Un corps.',
  tags: ['matrice'],
  featured: false,
}

const ATTENDU: Record<string, Attente> = {
  'GET /api/admin/articles': { anonyme: 401, editor: 200, tech: 200 },
  'POST /api/admin/articles': { anonyme: 401, editor: 201, tech: 201, corps: BROUILLON },
  'GET /api/admin/articles/[slug]': { anonyme: 401, editor: 200, tech: 200 },
  'PUT /api/admin/articles/[slug]': { anonyme: 401, editor: 200, tech: 200, corps: BROUILLON },
  'DELETE /api/admin/articles/[slug]': { anonyme: 401, editor: 404, tech: 404 },
  'PUT /api/admin/articles/[slug]/status': {
    anonyme: 401,
    editor: 200,
    tech: 200,
    corps: { status: 'draft' },
  },
  'POST /api/admin/preview': {
    anonyme: 401,
    editor: 200,
    tech: 200,
    corps: { bodyMd: '## Titre' },
  },
  'GET /api/admin/media': { anonyme: 401, editor: 200, tech: 200 },
  'POST /api/admin/media/upload-url': {
    anonyme: 401,
    editor: 201,
    tech: 201,
    corps: { filename: 'photo.png', contentType: 'image/png', bytes: 1024 },
  },
  'GET /api/admin/tags': { anonyme: 401, editor: 200, tech: 200 },
  'GET /api/admin/social-posts': { anonyme: 401, editor: 200, tech: 200 },
  'POST /api/admin/social-posts': {
    anonyme: 401,
    editor: 201,
    tech: 201,
    corps: { network: 'linkedin', url: 'https://www.linkedin.com/posts/x' },
  },
  // Identifiant inexistant : 404 après le contrôle de rôle, qui est ce
  // qu'on vérifie ici. Un anonyme, lui, reçoit 401 avant d'y arriver.
  'DELETE /api/admin/social-posts/[id]': { anonyme: 401, editor: 404, tech: 404 },
  'PUT /api/admin/social-posts/[id]/article': {
    anonyme: 401,
    editor: 404,
    tech: 404,
    corps: { articleSlug: null },
  },
  'PUT /api/admin/social-posts/[id]/visibility': {
    anonyme: 401,
    editor: 404,
    tech: 404,
    corps: { hidden: true },
  },
  'GET /api/admin/articles/[slug]/declinaisons': { anonyme: 401, editor: 200, tech: 200 },

  // --- Réservé au rôle technique -------------------------------------------
  'GET /api/admin/settings': { anonyme: 401, editor: 200, tech: 200 },
  // Un seul chemin, mais un rôle exigé qui DÉPEND DE LA CLÉ. La matrice
  // couvre ici le cas d'une clé publique ; l'autre portée est vérifiée par
  // le bloc « réglages par portée », qui énumère SETTING_SCOPE.
  'PUT /api/admin/settings/[cle]': {
    anonyme: 401,
    editor: 200,
    tech: 200,
    corps: {
      name: 'Un Max d’info',
      author: 'Maximilien Huet',
      byline: 'Max',
      tagline: '',
      pitch: '',
    },
  },

  'GET /api/admin/users': { anonyme: 401, editor: 403, tech: 200 },
  'GET /api/admin/instagram/status': { anonyme: 401, editor: 403, tech: 200 },
  // 409 et non 200 : Instagram n'est pas connecté dans les tests. Ce qui
  // compte ici est qu'un `editor` reçoive 403 AVANT d'en arriver là.
  'POST /api/admin/instagram/sync': { anonyme: 401, editor: 403, tech: 409 },
}

/**
 * Le slug sur lequel les routes paramétrées opèrent.
 *
 * DELETE vise volontairement un slug INEXISTANT et attend 404 : la matrice
 * vérifie l'autorisation, pas la suppression, et détruire l'article
 * casserait les cas suivants. Un 404 prouve tout autant que le contrôle de
 * rôle a été franchi — un anonyme, lui, reçoit 401 avant d'y arriver.
 */
const SLUG_EXISTANT = 'article-de-la-matrice'
const SLUG_ABSENT = 'jamais-vu-de-la-matrice'

let sqlClient: postgres.Sql
let db: BaseDeTest
const comptes: Record<'editor' | 'tech', number> = { editor: 0, tech: 0 }

beforeAll(async () => {
  sqlClient = connexion()
  await migrer(sqlClient)
  db = base(sqlClient)
  const [e] = await db
    .insert(appUser)
    .values({ email: 'max@exemple.test', role: 'editor' })
    .returning({ id: appUser.id })
  const [t] = await db
    .insert(appUser)
    .values({ email: 'jb@exemple.test', role: 'tech' })
    .returning({ id: appUser.id })
  comptes.editor = e?.id ?? 0
  comptes.tech = t?.id ?? 0

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
async function sessionPour(role: 'editor' | 'tech'): Promise<string> {
  const r = await fetch('/api/test/session', {
    method: 'POST',
    body: JSON.stringify({ id: comptes[role] }),
    headers: { 'content-type': 'application/json' },
  })
  return r.headers.get('set-cookie') ?? ''
}

describe('inventaire des routes', () => {
  it('la matrice couvre EXACTEMENT les routes admin existantes', () => {
    const existantes = routesDepuisFichiers(DOSSIER_ADMIN)
    const declarees = Object.keys(ATTENDU).sort()

    const oubliees = existantes.filter((r) => !declarees.includes(r))
    const orphelines = declarees.filter((r) => !existantes.includes(r))

    expect(oubliees, `Route(s) admin sans attente déclarée : ${oubliees.join(', ')}`).toEqual([])
    expect(orphelines, `Attente(s) sans route : ${orphelines.join(', ')}`).toEqual([])
  })

  it('trouve au moins une route, sinon l’inventaire ne prouve rien', () => {
    // Un inventaire vide ferait passer le test précédent sans rien vérifier.
    expect(routesDepuisFichiers(DOSSIER_ADMIN).length).toBeGreaterThan(0)
  })
})

describe('matrice route × rôle', () => {
  const cas = Object.entries(ATTENDU).flatMap(([route, attentes]) =>
    (['anonyme', 'editor', 'tech'] as const).map((qui) => [route, qui, attentes[qui]] as const),
  )

  it.each(cas)('%s — %s → %i', async (route, qui, attendu) => {
    const [methode, gabarit] = route.split(' ') as [string, string]
    const slug = methode === 'DELETE' ? SLUG_ABSENT : SLUG_EXISTANT
    // [id] vise volontairement une publication inexistante : la matrice
    // vérifie l'autorisation, pas la manipulation.
    const chemin = gabarit
      .replace('[slug]', slug)
      .replace('[id]', '999999')
      .replace('[cle]', 'identity')
    const cookie = qui === 'anonyme' ? '' : await sessionPour(qui)
    const corps = ATTENDU[route]?.corps

    const r = await fetch(chemin, {
      method: methode,
      headers: {
        ...(cookie ? { cookie } : {}),
        ...(corps ? { 'content-type': 'application/json' } : {}),
      },
      ...(corps ? { body: JSON.stringify(corps) } : {}),
    })
    expect(r.status).toBe(attendu)
  })
})

describe('réglages par portée', () => {
  /**
   * La frontière entre ce que Max règle et ce que seul JB voit.
   *
   * On ÉNUMÈRE SETTING_SCOPE au lieu de recopier la liste : un réglage
   * technique ajouté demain est couvert sans que personne n'y pense.
   */
  const cles = Object.keys(SETTING_SCOPE) as SettingKey[]

  it('il y a bien des réglages des deux portées', () => {
    expect(cles.filter((c) => SETTING_SCOPE[c] === 'tech').length).toBeGreaterThan(0)
    expect(cles.filter((c) => SETTING_SCOPE[c] === 'public').length).toBeGreaterThan(0)
  })

  it.each(cles)('PUT settings/%s — editor', async (cle) => {
    const attendu = SETTING_SCOPE[cle] === 'tech' ? 403 : 200
    const r = await fetch(`/api/admin/settings/${cle}`, {
      method: 'PUT',
      headers: { cookie: await sessionPour('editor'), 'content-type': 'application/json' },
      // Le schéma valide du réglage : un 400 masquerait le code qu'on teste.
      body: JSON.stringify(SETTING_DEFAULTS[cle]),
    })
    expect(r.status).toBe(attendu)
  })

  it('GET settings ne renvoie AUCUN réglage technique à un editor', async () => {
    const r = await fetch('/api/admin/settings', {
      headers: { cookie: await sessionPour('editor') },
    })
    const recus = Object.keys((await r.json()) as Record<string, unknown>)
    for (const cle of cles.filter((c) => SETTING_SCOPE[c] === 'tech')) {
      expect(recus, `${cle} ne doit pas être renvoyé à un editor`).not.toContain(cle)
    }
  })

  it('GET settings renvoie TOUT à un tech', async () => {
    const r = await fetch('/api/admin/settings', {
      headers: { cookie: await sessionPour('tech') },
    })
    const recus = Object.keys((await r.json()) as Record<string, unknown>)
    for (const cle of cles) expect(recus).toContain(cle)
  })
})

describe('invariant du projet', () => {
  it('editor reçoit 403 sur TOUTES les routes techniques', () => {
    const techniques = Object.entries(ATTENDU).filter(([, a]) => a.tech !== a.editor)
    expect(techniques.length).toBeGreaterThan(0)
    for (const [route, a] of techniques) {
      expect(a.editor, `${route} doit refuser editor`).toBe(403)
    }
  })

  it('aucune route admin n’est ouverte aux anonymes', () => {
    for (const [route, a] of Object.entries(ATTENDU)) {
      expect(a.anonyme, `${route} doit exiger une connexion`).toBe(401)
    }
  })
})
