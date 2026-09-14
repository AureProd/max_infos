import { readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { fetch, setup } from '@nuxt/test-utils/e2e'
import type postgres from 'postgres'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
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
 */
const ATTENDU: Record<string, { anonyme: number; editor: number; tech: number }> = {
  'GET /api/admin/articles': { anonyme: 401, editor: 200, tech: 200 },
  'GET /api/admin/users': { anonyme: 401, editor: 403, tech: 200 },
}

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
    const [methode, chemin] = route.split(' ') as [string, string]
    const cookie = qui === 'anonyme' ? '' : await sessionPour(qui)
    const r = await fetch(chemin, {
      method: methode,
      headers: cookie ? { cookie } : {},
    })
    expect(r.status).toBe(attendu)
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
